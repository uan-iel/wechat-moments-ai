import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const contentFormatSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  writingGuide: z.string().optional()
});

export async function GET() {
  const contentFormats = await prisma.contentFormat.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    include: {
      products: {
        orderBy: {
          updatedAt: "desc"
        },
        include: {
          assets: {
            orderBy: {
              updatedAt: "desc"
            }
          }
        }
      }
    }
  });

  return NextResponse.json({ contentFormats });
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = contentFormatSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content format payload" }, { status: 400 });
  }

  const contentFormat = await prisma.contentFormat.create({
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      writingGuide: parsed.data.writingGuide?.trim() || null
    },
    include: {
      products: true
    }
  });

  return NextResponse.json({ contentFormat }, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Content format id is required" }, { status: 400 });
  }

  const assets = await prisma.productAsset.findMany({
    where: {
      product: {
        contentFormatId: id
      }
    },
    select: {
      id: true
    }
  });
  const assetIds = new Set(assets.map((asset) => asset.id));

  if (assetIds.size) {
    const tasks = await prisma.contentTask.findMany({
      where: {
        selectedAssetIds: {
          hasSome: Array.from(assetIds)
        }
      },
      select: {
        id: true,
        selectedAssetIds: true
      }
    });

    await Promise.all(
      tasks.map((task) =>
        prisma.contentTask.update({
          where: {
            id: task.id
          },
          data: {
            selectedAssetIds: task.selectedAssetIds.filter((assetId) => !assetIds.has(assetId))
          }
        })
      )
    );
  }

  await prisma.contentFormat.delete({
    where: {
      id
    }
  });

  return NextResponse.json({ ok: true });
}
