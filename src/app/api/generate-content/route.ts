import { ContentTaskStatus, KnowledgeItemType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { generateMomentContent } from "@/lib/ai/content-generator";
import { prisma } from "@/lib/prisma";

const generateContentSchema = z.object({
  contentTaskId: z.string().min(1).optional(),
  campaignGoal: z.string().min(1),
  selectedStyleId: z.string().min(1),
  selectedKnowledgeIds: z.array(z.string().min(1)).min(1)
});

function formatKnowledgeType(type: KnowledgeItemType) {
  return type === KnowledgeItemType.IMAGE ? "图片" : "文本";
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = generateContentSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content generation payload" }, { status: 400 });
  }

  try {
    const styleProfile = await prisma.styleProfile.findUnique({
      where: {
        id: parsed.data.selectedStyleId
      },
      select: {
        id: true,
        analysisPrompt: true
      }
    });

    if (!styleProfile) {
      return NextResponse.json({ error: "Style profile not found" }, { status: 404 });
    }

    const knowledgeItems = await prisma.knowledgeItem.findMany({
      where: {
        id: {
          in: parsed.data.selectedKnowledgeIds
        }
      },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        imageUrl: true,
        tags: true
      }
    });

    if (knowledgeItems.length === 0) {
      return NextResponse.json(
        { error: "No knowledge items found for content generation" },
        { status: 422 }
      );
    }

    const { generatedContent, relevantKnowledge } = await generateMomentContent({
      campaignGoal: parsed.data.campaignGoal,
      styleDescription: styleProfile.analysisPrompt,
      knowledgeItems: knowledgeItems.map((item) => ({
        id: item.id,
        type: formatKnowledgeType(item.type),
        title: item.title,
        content: item.content,
        imageUrl: item.imageUrl,
        tags: item.tags
      }))
    });
    const imageUrls = relevantKnowledge
      .map((item) => item.imageUrl)
      .filter((url): url is string => Boolean(url));

    const contentTask = await prisma.contentTask.upsert({
      where: {
        id: parsed.data.contentTaskId ?? "__new_task__"
      },
      update: {
        title: parsed.data.campaignGoal,
        campaignGoal: parsed.data.campaignGoal,
        selectedStyleId: parsed.data.selectedStyleId,
        selectedKnowledgeIds: relevantKnowledge.map((item) => item.id),
        status: ContentTaskStatus.DRAFT
      },
      create: {
        title: parsed.data.campaignGoal,
        campaignGoal: parsed.data.campaignGoal,
        selectedStyleId: parsed.data.selectedStyleId,
        selectedKnowledgeIds: relevantKnowledge.map((item) => item.id),
        status: ContentTaskStatus.DRAFT
      }
    });
    const versionCount = await prisma.contentVersion.count({
      where: {
        taskId: contentTask.id
      }
    });
    const contentVersion = await prisma.contentVersion.create({
      data: {
        taskId: contentTask.id,
        label: versionCount === 0 ? "初稿" : `重新生成 v${versionCount + 1}`,
        content: generatedContent.trim(),
        imageUrls
      }
    });

    return NextResponse.json({
      contentTask,
      contentVersion,
      generatedContent,
      retrievedKnowledgeItems: relevantKnowledge
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate content"
      },
      { status: 500 }
    );
  }
}
