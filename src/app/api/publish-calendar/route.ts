import { PublishCalendarStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const calendarEntrySchema = z.object({
  taskId: z.string().min(1),
  versionId: z.string().min(1).optional(),
  plannedDate: z.string().datetime(),
  status: z.nativeEnum(PublishCalendarStatus).default(PublishCalendarStatus.PLANNED),
  note: z.string().optional()
});

export async function GET() {
  const entries = await prisma.publishCalendarEntry.findMany({
    orderBy: {
      plannedDate: "asc"
    },
    select: {
      id: true,
      taskId: true,
      versionId: true,
      plannedDate: true,
      status: true,
      note: true,
      createdAt: true,
      updatedAt: true,
      task: {
        select: {
          id: true,
          title: true,
          campaignGoal: true,
          status: true,
          versions: {
            where: {
              isFinal: true
            },
            take: 1,
            select: {
              id: true,
              label: true,
              content: true
            }
          }
        }
      }
    }
  });
  const tasks = await prisma.contentTask.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      title: true,
      status: true,
      versions: {
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          label: true,
          content: true,
          isFinal: true
        }
      }
    }
  });

  return NextResponse.json({ entries, tasks });
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = calendarEntrySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid calendar entry payload" }, { status: 400 });
  }

  const entry = await prisma.publishCalendarEntry.create({
    data: {
      taskId: parsed.data.taskId,
      versionId: parsed.data.versionId,
      plannedDate: new Date(parsed.data.plannedDate),
      status: parsed.data.status,
      note: parsed.data.note?.trim() || null
    }
  });

  return NextResponse.json({ entry }, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Calendar entry id is required" }, { status: 400 });
  }

  await prisma.publishCalendarEntry.delete({
    where: {
      id
    }
  });

  return NextResponse.json({ ok: true });
}
