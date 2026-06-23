import {
  ContentPlatform,
  ResearchCrawlStatus,
  ResearchCrawlerType
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { mediaCrawlerRequest, startMediaCrawlerWorker } from "@/lib/research/media-crawler";
import { importXiaohongshuResearchPayload } from "@/lib/research/xiaohongshu-import";
import { analyzeXiaohongshuResearch } from "@/lib/research/xiaohongshu-research";

export const dynamic = "force-dynamic";

const crawlSchema = z.object({
  crawlerType: z.enum(["search", "creator"]).default("search"),
  collectionName: z.string().min(1),
  query: z.string().optional(),
  creatorIds: z.array(z.string().min(1)).default([]),
  cookies: z.string().optional(),
  startPage: z.number().int().min(1).default(1),
  maxNotesCount: z.number().int().min(1).max(500).default(40),
  enableComments: z.boolean().default(false),
  autoAnalyze: z.boolean().default(true)
});

function globalMonitorState() {
  const globalState = globalThis as unknown as {
    xhsCrawlJobMonitors?: Set<string>;
  };

  if (!globalState.xhsCrawlJobMonitors) {
    globalState.xhsCrawlJobMonitors = new Set<string>();
  }

  return globalState.xhsCrawlJobMonitors;
}

async function importLatestMediaCrawlerResult(jobId: string, autoAnalyze: boolean) {
  const job = await prisma.researchCrawlJob.findUnique({
    where: { id: jobId }
  });

  if (!job) {
    return;
  }

  await prisma.researchCrawlJob.update({
    where: { id: jobId },
    data: {
      status: ResearchCrawlStatus.IMPORTING
    }
  });

  const filesPayload = (await mediaCrawlerRequest("/api/data/files?platform=xhs&file_type=json")) as {
    files?: Array<{ path: string; modified_at: number | string; name: string }>;
  };
  const latest = (filesPayload.files || [])
    .sort((left, right) => Number(right.modified_at) - Number(left.modified_at))[0];

  if (!latest) {
    throw new Error("抓取结束了，但没有找到可导入的小红书 JSON 结果文件。");
  }

  const rawText = (await mediaCrawlerRequest(
    `/api/data/files/${encodeURIComponent(latest.path)}?preview=false`
  )) as string;
  const payload = JSON.parse(rawText);
  const imported = await importXiaohongshuResearchPayload(prisma, {
    payload,
    collectionName: job.collectionName,
    sourceQuery: job.query,
    description: `Imported from MediaCrawler: ${latest.name}`,
    sourceType: "media-crawler-api"
  });

  await prisma.researchCrawlJob.update({
    where: { id: jobId },
    data: {
      status: ResearchCrawlStatus.COMPLETED,
      notesImported: imported.notesImported,
      sourceFilePath: latest.path,
      finishedAt: new Date()
    }
  });

  if (!autoAnalyze) {
    return;
  }

  const collection = await prisma.researchCollection.findUnique({
    where: {
      id: imported.collection.id
    },
    include: {
      notes: {
        orderBy: {
          publishedAt: "desc"
        }
      }
    }
  });

  if (!collection) {
    return;
  }

  const scopeKey = job.query || job.collectionName;
  const insight = await analyzeXiaohongshuResearch({
    collectionName: collection.name,
    scopeKey,
    notes: collection.notes.map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      authorName: note.authorName,
      noteUrl: note.noteUrl,
      publishedAt: note.publishedAt,
      keywords: note.keywords,
      likeCount: note.likeCount,
      commentCount: note.commentCount,
      collectCount: note.collectCount,
      shareCount: note.shareCount,
      viewCount: note.viewCount
    }))
  });

  await prisma.researchInsight.create({
    data: {
      collectionId: collection.id,
      platform: ContentPlatform.XIAOHONGSHU,
      scopeKey,
      title: insight.title,
      summary: insight.summary,
      recommendations: insight.recommendations,
      topKeywords: insight.topKeywords
    }
  });
}

async function monitorCrawlJob(jobId: string, autoAnalyze: boolean) {
  const monitors = globalMonitorState();

  if (monitors.has(jobId)) {
    return;
  }

  monitors.add(jobId);

  try {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 20 * 60 * 1000) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const statusPayload = (await mediaCrawlerRequest("/api/crawler/status")) as {
        status?: "idle" | "running" | "stopping" | "error";
        error_message?: string | null;
      };

      if (statusPayload.status === "error") {
        throw new Error(statusPayload.error_message || "MediaCrawler reported an error.");
      }

      if (statusPayload.status === "idle") {
        await importLatestMediaCrawlerResult(jobId, autoAnalyze);
        return;
      }
    }

    throw new Error("抓取超时，请稍后刷新任务状态。");
  } catch (error) {
    await prisma.researchCrawlJob.update({
      where: { id: jobId },
      data: {
        status: ResearchCrawlStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "Crawl failed",
        finishedAt: new Date()
      }
    });
  } finally {
    monitors.delete(jobId);
  }
}

export async function GET() {
  const [status, jobs] = await Promise.all([
    mediaCrawlerRequest("/api/crawler/status").catch(() => ({ status: "idle" })),
    prisma.researchCrawlJob.findMany({
      where: {
        platform: ContentPlatform.XIAOHONGSHU
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 12
    })
  ]);

  return NextResponse.json({
    workerStatus: status,
    jobs
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = crawlSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid crawl payload" }, { status: 400 });
  }

  if (parsed.data.crawlerType === "search" && !parsed.data.query?.trim()) {
    return NextResponse.json({ error: "搜索模式需要填写关键词。" }, { status: 400 });
  }

  if (parsed.data.crawlerType === "creator" && parsed.data.creatorIds.length === 0) {
    return NextResponse.json({ error: "Creator 模式需要至少 1 个 creator id。" }, { status: 400 });
  }

  await startMediaCrawlerWorker();

  const job = await prisma.researchCrawlJob.create({
    data: {
      platform: ContentPlatform.XIAOHONGSHU,
      collectionName: parsed.data.collectionName.trim(),
      query: parsed.data.query?.trim() || null,
      creatorIds: parsed.data.creatorIds,
      crawlerType:
        parsed.data.crawlerType === "creator" ? ResearchCrawlerType.CREATOR : ResearchCrawlerType.SEARCH,
      status: ResearchCrawlStatus.RUNNING,
      startedAt: new Date()
    }
  });

  await mediaCrawlerRequest("/api/crawler/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      platform: "xhs",
      login_type: "cookie",
      crawler_type: parsed.data.crawlerType,
      keywords: parsed.data.query || "",
      creator_ids: parsed.data.creatorIds.join(","),
      start_page: parsed.data.startPage,
      enable_comments: parsed.data.enableComments,
      enable_sub_comments: false,
      save_option: "json",
      cookies: parsed.data.cookies || "",
      headless: true,
      max_notes_count: parsed.data.maxNotesCount
    })
  });

  void monitorCrawlJob(job.id, parsed.data.autoAnalyze);

  return NextResponse.json({
    ok: true,
    job
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId")?.trim();

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const job = await prisma.researchCrawlJob.findFirst({
    where: {
      id: jobId,
      platform: ContentPlatform.XIAOHONGSHU
    },
    select: {
      id: true
    }
  });

  if (!job) {
    return NextResponse.json({ error: "Crawl job not found" }, { status: 404 });
  }

  await prisma.researchCrawlJob.delete({
    where: {
      id: job.id
    }
  });

  return NextResponse.json({
    ok: true,
    deleted: {
      jobId: job.id
    }
  });
}
