import {
  ContentPlatform,
  ResearchCrawlStatus,
  ResearchCrawlerType
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  getLoginBrowserStatus,
  mediaCrawlerRequest,
  startMediaCrawlerWorker
} from "@/lib/research/media-crawler";
import { importXiaohongshuResearchPayload } from "@/lib/research/xiaohongshu-import";
import { analyzeXiaohongshuResearch } from "@/lib/research/xiaohongshu-research";
import { getActiveProjectFromRequest } from "@/lib/projects";

export const dynamic = "force-dynamic";

const crawlSchema = z.object({
  crawlerType: z.enum(["search", "creator"]).default("search"),
  collectionName: z.string().min(1),
  query: z.string().optional(),
  creatorIds: z.array(z.string().min(1)).default([]),
  cookies: z.string().optional(),
  startPage: z.number().int().min(1).default(1),
  maxNotesCount: z.number().int().min(1).max(500).default(50),
  enableComments: z.boolean().default(false),
  autoAnalyze: z.boolean().default(false)
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

function chooseImportFile(
  files: Array<{ path: string; modified_at: number | string; name: string }>,
  startedAt?: Date | null
) {
  const sorted = [...files].sort(
    (left, right) => fileModifiedAtMs(right.modified_at) - fileModifiedAtMs(left.modified_at)
  );

  if (!startedAt) {
    return sorted[0];
  }

  const threshold = startedAt.getTime() - 15 * 1000;
  const startedAfterFiles = sorted.filter((file) => fileModifiedAtMs(file.modified_at) >= threshold);

  return startedAfterFiles[0] || null;
}

function fileModifiedAtMs(value: number | string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return numericValue < 10_000_000_000 ? numericValue * 1000 : numericValue;
}

type MediaCrawlerLogEntry = {
  id?: number;
  timestamp?: string;
  level?: string;
  message?: string;
};

async function fetchRecentCrawlerLogs() {
  const payload = (await mediaCrawlerRequest("/api/crawler/logs?limit=400")) as {
    logs?: MediaCrawlerLogEntry[];
  };

  return payload.logs || [];
}

function findJobStartLogIndex(logs: MediaCrawlerLogEntry[], job: {
  query: string | null;
  creatorIds: string[];
  crawlerType: ResearchCrawlerType;
}) {
  const jobNeedle =
    job.crawlerType === ResearchCrawlerType.CREATOR
      ? job.creatorIds.join(",").trim()
      : (job.query || "").trim();

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const message = logs[index]?.message || "";

    if (!message.includes("Starting crawler:")) {
      continue;
    }

    if (!jobNeedle || message.includes(jobNeedle)) {
      return index;
    }
  }

  return -1;
}

function countFetchedNotes(message: string) {
  const singleQuoteMatches = message.match(/'model_type': 'note'/g);
  if (singleQuoteMatches?.length) {
    return singleQuoteMatches.length;
  }

  const doubleQuoteMatches = message.match(/"model_type"\s*:\s*"note"/g);
  return doubleQuoteMatches?.length || 0;
}

function extractTargetNoteCount(logs: MediaCrawlerLogEntry[], fallback = 50) {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const message = logs[index]?.message || "";
    const match = message.match(/--crawler_max_notes_count\s+(\d+)/);

    if (match) {
      return Number(match[1]);
    }
  }

  return fallback;
}

function extractCurrentPage(logs: MediaCrawlerLogEntry[]) {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const message = logs[index]?.message || "";
    const match = message.match(/page:\s*(\d+)/i);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function inferJobProgress(job: {
  query: string | null;
  creatorIds: string[];
  crawlerType: ResearchCrawlerType;
  status: ResearchCrawlStatus;
  notesImported: number | null;
  errorMessage: string | null;
}, logs: MediaCrawlerLogEntry[]) {
  if (job.status === ResearchCrawlStatus.FAILED) {
    return {
      progressPercent: null,
      progressLabel: "任务失败",
      progressDetail: job.errorMessage || "抓取失败"
    };
  }

  if (job.status === ResearchCrawlStatus.PENDING) {
    return {
      progressPercent: 0,
      progressLabel: "等待启动",
      progressDetail: "任务已创建，等待 crawler 开始执行。"
    };
  }

  if (job.status === ResearchCrawlStatus.IMPORTING) {
    return {
      progressPercent: 100,
      progressLabel: "抓取完成，正在入库",
      progressDetail: "样本已经抓完，正在写入本地研究库。"
    };
  }

  if (job.status === ResearchCrawlStatus.COMPLETED) {
    return {
      progressPercent: 100,
      progressLabel: "抓取与入库完成",
      progressDetail: job.notesImported
        ? `已入库 ${job.notesImported} 条样本。`
        : "样本已入库完成。"
    };
  }

  const target = extractTargetNoteCount(logs, 50);
  const fetched = logs.reduce((sum, log) => {
    const message = log.message || "";

    if (!message.includes("Search notes response:")) {
      return sum;
    }

    return sum + countFetchedNotes(message);
  }, 0);
  const currentPage = extractCurrentPage(logs);
  const effectiveFetched = Math.min(fetched, target);
  const progressPercent = target > 0 ? Math.max(1, Math.min(99, Math.round((effectiveFetched / target) * 100))) : null;
  const pageText = currentPage ? `，当前到第 ${currentPage} 页` : "";

  return {
    progressPercent,
    progressLabel: "正在抓取样本",
    progressDetail:
      progressPercent === null
        ? "抓取任务已启动，正在等待首批样本返回。"
        : `已抓取约 ${effectiveFetched} / ${target} 条${pageText}。`
  };
}

function inferCrawlerFailureReason(logs: MediaCrawlerLogEntry[]) {
  const messages = logs.map((log) => log.message || "").filter(Boolean);
  const joined = messages.join("\n");

  if (/没有权限访问/.test(joined)) {
    return "本次抓取被小红书拦截：当前登录账号没有权限访问该搜索结果。请切换账号、重新登录，或稍后再试。";
  }

  if (/Login state result:\s*False/i.test(joined) || /Begin login xiaohongshu/i.test(joined)) {
    return "本次抓取没有使用到有效的小红书登录态。请先在登录浏览器里重新登录小红书，再发起抓取。";
  }

  if (/RetryError|DataFetchError|Traceback/i.test(joined)) {
    const lastMeaningfulError = [...messages]
      .reverse()
      .find((message) => /error|exception|failed|RetryError|DataFetchError|权限|登录/i.test(message));

    if (lastMeaningfulError) {
      return `抓取器执行失败：${lastMeaningfulError}`;
    }
  }

  return null;
}

async function resolveCrawlerFailureReason(fallbackMessage: string) {
  const logs = await fetchRecentCrawlerLogs().catch(() => []);
  return inferCrawlerFailureReason(logs) || fallbackMessage;
}

async function waitForImportFile(startedAt?: Date | null) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const filesPayload = (await mediaCrawlerRequest("/api/data/files?platform=xhs&file_type=json")) as {
      files?: Array<{ path: string; modified_at: number | string; name: string }>;
    };
    const latest = chooseImportFile(filesPayload.files || [], startedAt);

    if (latest) {
      return latest;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return null;
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

  const latest = await waitForImportFile(job.startedAt);

  if (!latest) {
    throw new Error(
      await resolveCrawlerFailureReason("抓取结束了，但本次没有产出新的小红书结果文件。请检查登录状态或稍后重试。")
    );
  }

  const rawText = (await mediaCrawlerRequest(
    `/api/data/files/${encodeURIComponent(latest.path)}?preview=false`
  )) as string;
  const payload = JSON.parse(rawText);
  const imported = await importXiaohongshuResearchPayload(prisma, {
    projectId: job.projectId,
    payload,
    collectionName: job.collectionName,
    sourceQuery: job.query,
    description: `Imported from MediaCrawler: ${latest.name}`,
    sourceType: "media-crawler-api"
  }).catch(async (error) => {
    const message =
      error instanceof Error ? error.message : "小红书结果导入失败，请稍后重试。";

    throw new Error(await resolveCrawlerFailureReason(message));
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
      projectId: job.projectId,
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
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusPayload = (await mediaCrawlerRequest("/api/crawler/status")) as {
        status?: "idle" | "running" | "stopping" | "error";
        error_message?: string | null;
      };

      if (statusPayload.status === "error") {
        throw new Error(
          await resolveCrawlerFailureReason(statusPayload.error_message || "MediaCrawler reported an error.")
        );
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

export async function GET(request: Request) {
  const project = await getActiveProjectFromRequest(request);
  const [status, jobs, collections, logs] = await Promise.all([
    mediaCrawlerRequest("/api/crawler/status").catch(() => ({ status: "idle" })),
    prisma.researchCrawlJob.findMany({
      where: {
        projectId: project.id,
        platform: ContentPlatform.XIAOHONGSHU
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 12
    }),
    prisma.researchCollection.findMany({
      where: {
        projectId: project.id,
        platform: ContentPlatform.XIAOHONGSHU
      },
      select: {
        name: true,
        _count: {
          select: {
            insights: true
          }
        }
      }
    }),
    fetchRecentCrawlerLogs().catch(() => [])
  ]);

  const insightCountByCollection = new Map(collections.map((collection) => [collection.name, collection._count.insights]));

  return NextResponse.json({
    workerStatus: status,
    jobs: jobs.map((job) => {
      const startIndex =
        job.status === ResearchCrawlStatus.RUNNING || job.status === ResearchCrawlStatus.IMPORTING
          ? findJobStartLogIndex(logs, job)
          : -1;
      const relevantLogs = startIndex >= 0 ? logs.slice(startIndex) : [];
      const progress = inferJobProgress(job, relevantLogs);
      const insightCount = insightCountByCollection.get(job.collectionName) || 0;

      return {
        ...job,
        analysisPending: job.status === ResearchCrawlStatus.COMPLETED && insightCount === 0,
        progressPercent: progress.progressPercent,
        progressLabel: progress.progressLabel,
        progressDetail: progress.progressDetail
      };
    })
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = crawlSchema.safeParse(body);
  const project = await getActiveProjectFromRequest(request);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid crawl payload" }, { status: 400 });
  }

  if (parsed.data.crawlerType === "search" && !parsed.data.query?.trim()) {
    return NextResponse.json({ error: "搜索模式需要填写关键词。" }, { status: 400 });
  }

  if (parsed.data.crawlerType === "creator" && parsed.data.creatorIds.length === 0) {
    return NextResponse.json({ error: "Creator 模式需要至少 1 个 creator id。" }, { status: 400 });
  }

  const browserStatus = await getLoginBrowserStatus();
  const hasCookieFallback = Boolean(parsed.data.cookies?.trim());

  if (!browserStatus.healthy && !hasCookieFallback) {
    return NextResponse.json(
      {
        error:
          "还没有检测到可用的小红书登录浏览器。请先点击“打开并聚焦登录浏览器”，在那个窗口里登录小红书，或改用 Cookies 临时会话后再抓取。"
      },
      { status: 400 }
    );
  }

  await startMediaCrawlerWorker();

  const job = await prisma.researchCrawlJob.create({
    data: {
      projectId: project.id,
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
  const project = await getActiveProjectFromRequest(request);

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const job = await prisma.researchCrawlJob.findFirst({
    where: {
      id: jobId,
      projectId: project.id,
      platform: ContentPlatform.XIAOHONGSHU
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!job) {
    return NextResponse.json({ error: "Crawl job not found" }, { status: 404 });
  }

  if (
    job.status === ResearchCrawlStatus.RUNNING ||
    job.status === ResearchCrawlStatus.IMPORTING ||
    job.status === ResearchCrawlStatus.PENDING
  ) {
    return NextResponse.json(
      { error: "抓取任务仍在运行中，完成或失败后再删除。" },
      { status: 409 }
    );
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
