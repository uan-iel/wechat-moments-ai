import { ContentPlatform } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeXiaohongshuResearch } from "@/lib/research/xiaohongshu-research";
import { prisma } from "@/lib/prisma";
import { getActiveProjectFromRequest } from "@/lib/projects";

export const dynamic = "force-dynamic";

const analyzeSchema = z.object({
  collectionId: z.string().min(1).optional(),
  collectionName: z.string().min(1).optional(),
  scopeKey: z.string().min(1).optional()
});

const curateNotesSchema = z.object({
  collectionId: z.string().min(1),
  noteIds: z.array(z.string().min(1)).min(1)
});

function metric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function noteDataScore(note: {
  likeCount: number | null;
  commentCount: number | null;
  collectCount: number | null;
  shareCount: number | null;
  viewCount: number | null;
}) {
  const likes = metric(note.likeCount);
  const comments = metric(note.commentCount);
  const collects = metric(note.collectCount);
  const shares = metric(note.shareCount);
  const views = metric(note.viewCount);
  const likeRate = views > 0 ? likes / views : 0;
  const commentRate = views > 0 ? comments / views : 0;
  const collectRate = views > 0 ? collects / views : 0;

  return likes + comments * 2.6 + collects * 2.8 + shares * 1.8 + likeRate * 600 + commentRate * 900 + collectRate * 750;
}

export async function GET(request: Request) {
  const project = await getActiveProjectFromRequest(request);
  const collections = await prisma.researchCollection.findMany({
    where: {
      projectId: project.id,
      platform: ContentPlatform.XIAOHONGSHU
    },
    include: {
      insights: {
        orderBy: {
          updatedAt: "desc"
        },
        take: 1
      },
      notes: {
        orderBy: [{ likeCount: "desc" }, { publishedAt: "desc" }],
        select: {
          id: true,
          title: true,
          authorName: true,
          noteUrl: true,
          publishedAt: true,
          keywords: true,
          likeCount: true,
          commentCount: true,
          collectCount: true,
          shareCount: true,
          viewCount: true
        }
      },
      _count: {
        select: {
          notes: true,
          insights: true
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return NextResponse.json({
    collections: collections.map((collection) => ({
      ...collection,
      notes: [...collection.notes].sort((left, right) => {
        const scoreDelta = noteDataScore(right) - noteDataScore(left);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        return metric(right.likeCount) - metric(left.likeCount);
      })
    }))
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = analyzeSchema.safeParse(body);
  const project = await getActiveProjectFromRequest(request);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid research analyze payload" }, { status: 400 });
  }

  const collection = await prisma.researchCollection.findFirst({
    where: {
      projectId: project.id,
      platform: ContentPlatform.XIAOHONGSHU,
      ...(parsed.data.collectionId
        ? {
            id: parsed.data.collectionId
          }
        : {
            name: parsed.data.collectionName
          })
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
    return NextResponse.json({ error: "Research collection not found" }, { status: 404 });
  }

  const scopeKey = parsed.data.scopeKey?.trim() || collection.sourceQuery || collection.name;
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

  const saved = await prisma.researchInsight.create({
    data: {
      projectId: project.id,
      collectionId: collection.id,
      platform: ContentPlatform.XIAOHONGSHU,
      scopeKey,
      title: insight.title,
      summary: insight.summary,
      recommendations: insight.recommendations,
      topKeywords: insight.topKeywords
    }
  });

  return NextResponse.json({
    collection: {
      id: collection.id,
      name: collection.name,
      noteCount: collection.notes.length
    },
    insight: saved
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const collectionId = searchParams.get("collectionId")?.trim();
  const project = await getActiveProjectFromRequest(request);

  if (!collectionId) {
    return NextResponse.json({ error: "Missing collectionId" }, { status: 400 });
  }

  const collection = await prisma.researchCollection.findFirst({
    where: {
      id: collectionId,
      projectId: project.id,
      platform: ContentPlatform.XIAOHONGSHU
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!collection) {
    return NextResponse.json({ error: "Research collection not found" }, { status: 404 });
  }

  const [deletedInsights, deletedJobs] = await prisma.$transaction([
    prisma.researchInsight.deleteMany({
      where: {
        projectId: project.id,
        collectionId: collection.id
      }
    }),
    prisma.researchCrawlJob.deleteMany({
      where: {
        projectId: project.id,
        platform: ContentPlatform.XIAOHONGSHU,
        collectionName: collection.name
      }
    }),
    prisma.researchCollection.delete({
      where: {
        id: collection.id
      }
    })
  ]).then(([insights, jobs]) => [insights, jobs] as const);

  return NextResponse.json({
    ok: true,
    deleted: {
      collectionId: collection.id,
      collectionName: collection.name,
      insights: deletedInsights.count,
      crawlJobs: deletedJobs.count
    }
  });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = curateNotesSchema.safeParse(body);
  const project = await getActiveProjectFromRequest(request);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid note curation payload" }, { status: 400 });
  }

  const collection = await prisma.researchCollection.findFirst({
    where: {
      id: parsed.data.collectionId,
      projectId: project.id,
      platform: ContentPlatform.XIAOHONGSHU
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!collection) {
    return NextResponse.json({ error: "Research collection not found" }, { status: 404 });
  }

  const [deletedInsights, deletedNotes, remainingNotes] = await prisma.$transaction([
    prisma.researchInsight.deleteMany({
      where: {
        projectId: project.id,
        collectionId: collection.id
      }
    }),
    prisma.researchNote.deleteMany({
      where: {
        collectionId: collection.id,
        id: {
          in: parsed.data.noteIds
        }
      }
    }),
    prisma.researchNote.count({
      where: {
        collectionId: collection.id
      }
    })
  ]);

  return NextResponse.json({
    ok: true,
    curated: {
      collectionId: collection.id,
      collectionName: collection.name,
      deletedNotes: deletedNotes.count,
      deletedInsights: deletedInsights.count,
      remainingNotes
    }
  });
}
