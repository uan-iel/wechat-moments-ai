import { NextResponse } from "next/server";

import { normalizePlatform } from "@/lib/platforms";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const platform = new URL(request.url).searchParams.get("platform");
  const contentTasks = await prisma.contentTask.findMany({
    where: platform
      ? {
          platform: normalizePlatform(platform)
        }
      : undefined,
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      platform: true,
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
