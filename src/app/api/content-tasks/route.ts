import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const contentTasks = await prisma.contentTask.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      title: true,
      campaignGoal: true,
      status: true,
      updatedAt: true,
      contentFormat: {
        select: {
          id: true,
          name: true
        }
      },
      product: {
        select: {
          id: true,
          name: true
        }
      },
      versions: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1,
        select: {
          id: true,
          label: true,
          content: true,
          isFinal: true,
          createdAt: true
        }
      },
      _count: {
        select: {
          versions: true,
          calendarEntries: true
        }
      }
    }
  });

  return NextResponse.json({ contentTasks });
}
