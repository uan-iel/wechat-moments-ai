import { ContentTaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getActiveProjectFromRequest } from "@/lib/projects";

const createVersionSchema = z.object({
  content: z.string().min(1),
  label: z.string().optional(),
  imageUrls: z.array(z.string()).default([])
});

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, { params }: RouteContext) {
  const json = await request.json();
  const parsed = createVersionSchema.safeParse(json);
  const project = await getActiveProjectFromRequest(request);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content version payload" }, { status: 400 });
  }

  const task = await prisma.contentTask.findUnique({
    where: {
      id: params.id
    },
    select: {
      id: true,
      projectId: true
    }
  });

  if (!task || task.projectId !== project.id) {
    return NextResponse.json({ error: "Content task not found" }, { status: 404 });
  }

  const versionCount = await prisma.contentVersion.count({
    where: {
      taskId: params.id
    }
  });
  const contentVersion = await prisma.contentVersion.create({
    data: {
      taskId: params.id,
      label: parsed.data.label?.trim() || `手动修改 v${versionCount + 1}`,
      content: parsed.data.content.trim(),
      imageUrls: parsed.data.imageUrls
    }
  });

  await prisma.contentTask.update({
    where: {
      id: params.id
    },
    data: {
      status: ContentTaskStatus.DRAFT
    }
  });

  return NextResponse.json({ contentVersion }, { status: 201 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const versionId = new URL(request.url).searchParams.get("versionId");
  const project = await getActiveProjectFromRequest(request);

  if (!versionId) {
    return NextResponse.json({ error: "Content version id is required" }, { status: 400 });
  }

  const version = await prisma.contentVersion.findFirst({
    where: {
      id: versionId,
      taskId: params.id,
      task: {
        projectId: project.id
      }
    },
    select: {
      id: true,
      isFinal: true
    }
  });

  if (!version) {
    return NextResponse.json({ error: "Content version not found" }, { status: 404 });
  }

  await prisma.contentVersion.delete({
    where: {
      id: versionId
    }
  });

  if (version.isFinal) {
    await prisma.contentTask.update({
      where: {
        id: params.id
      },
      data: {
        status: ContentTaskStatus.DRAFT
      }
    });
  }

  return NextResponse.json({ ok: true });
}
