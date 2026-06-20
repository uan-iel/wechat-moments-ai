import { ContentTaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { reviseMomentContent } from "@/lib/ai/content-reviser";
import { prisma } from "@/lib/prisma";

const reviseContentSchema = z.object({
  contentTaskId: z.string().min(1),
  contentVersionId: z.string().min(1),
  revisionInstruction: z.string().min(1)
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = reviseContentSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid revise payload" }, { status: 400 });
  }

  const contentVersion = await prisma.contentVersion.findFirst({
    where: {
      id: parsed.data.contentVersionId,
      taskId: parsed.data.contentTaskId
    }
  });

  if (!contentVersion) {
    return NextResponse.json({ error: "Content version not found" }, { status: 404 });
  }

  try {
    const revisedContent = await reviseMomentContent({
      content: contentVersion.content,
      revisionInstruction: parsed.data.revisionInstruction
    });
    const versionCount = await prisma.contentVersion.count({
      where: {
        taskId: parsed.data.contentTaskId
      }
    });
    const revisedVersion = await prisma.contentVersion.create({
      data: {
        taskId: parsed.data.contentTaskId,
        label: `AI改写 v${versionCount + 1}`,
        content: revisedContent.trim(),
        imageUrls: contentVersion.imageUrls,
        revisionInstruction: parsed.data.revisionInstruction.trim()
      }
    });
    const contentTask = await prisma.contentTask.update({
      where: {
        id: parsed.data.contentTaskId
      },
      data: {
        status: ContentTaskStatus.DRAFT
      },
      select: {
        id: true,
        status: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      contentTask,
      contentVersion: revisedVersion,
      revisedContent
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to revise content"
      },
      { status: 500 }
    );
  }
}
