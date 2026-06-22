import { ContentPlatform } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeXiaohongshuResearch } from "@/lib/research/xiaohongshu-research";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const analyzeSchema = z.object({
  collectionId: z.string().min(1).optional(),
  collectionName: z.string().min(1).optional(),
  scopeKey: z.string().min(1).optional()
});

export async function GET() {
  const collections = await prisma.researchCollection.findMany({
    where: {
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
        take: 5,
        select: {
          id: true,
          title: true,
          content: true,
          authorName: true,
          noteUrl: true,
          publishedAt: true,
          keywords: true,
          likeCount: true,
          commentCount: true,
          collectCount: true
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
    collections
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = analyzeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid research analyze payload" }, { status: 400 });
  }

  const collection = await prisma.researchCollection.findFirst({
    where: {
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
