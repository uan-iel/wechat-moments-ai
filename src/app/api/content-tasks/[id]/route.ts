import { ContentTaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const updateContentTaskSchema = z.object({
  title: z.string().min(1).optional(),
  finalizedVersionId: z.string().min(1).optional()
});

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  const contentTask = await prisma.contentTask.findUnique({
    where: {
      id: params.id
    },
    select: {
      id: true,
      title: true,
      campaignGoal: true,
      selectedStyleId: true,
      selectedKnowledgeIds: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      selectedStyle: {
        select: {
          id: true,
          name: true,
          analysisPrompt: true
        }
      },
      versions: {
        orderBy: {
          createdAt: "asc"
        }
      },
      calendarEntries: {
        orderBy: {
          plannedDate: "asc"
        }
      }
    }
  });

  if (!contentTask) {
    return NextResponse.json({ error: "Content task not found" }, { status: 404 });
  }

  const knowledgeItems = await prisma.knowledgeItem.findMany({
    where: {
      id: {
        in: contentTask.selectedKnowledgeIds
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

  return NextResponse.json({
    contentTask: {
      ...contentTask,
      knowledgeItems
    }
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const json = await request.json();
  const parsed = updateContentTaskSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content task payload" }, { status: 400 });
  }

  if (parsed.data.finalizedVersionId) {
    const version = await prisma.contentVersion.findFirst({
      where: {
        id: parsed.data.finalizedVersionId,
        taskId: params.id
      },
      select: {
        id: true
      }
    });

    if (!version) {
      return NextResponse.json({ error: "Content version not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.contentVersion.updateMany({
        where: {
          taskId: params.id
        },
        data: {
          isFinal: false
        }
      }),
      prisma.contentVersion.update({
        where: {
          id: parsed.data.finalizedVersionId
        },
        data: {
          isFinal: true
        }
      })
    ]);
  }

  const contentTask = await prisma.contentTask.update({
    where: {
      id: params.id
    },
    data: {
      ...(parsed.data.title ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.finalizedVersionId ? { status: ContentTaskStatus.FINALIZED } : {})
    },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true
    }
  });

  return NextResponse.json({ contentTask });
}
