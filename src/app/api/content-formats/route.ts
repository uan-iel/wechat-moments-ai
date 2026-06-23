import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizePlatform } from "@/lib/platforms";
import { prisma } from "@/lib/prisma";
import { getActiveProjectFromRequest } from "@/lib/projects";
import { removeProductAssetFile } from "@/lib/server/product-asset-files";

export const dynamic = "force-dynamic";

const contentFormatSchema = z.object({
  platform: z.enum(["MOMENTS", "XIAOHONGSHU"]).default("MOMENTS"),
  name: z.string().min(1),
  description: z.string().optional(),
  writingGuide: z.string().optional()
});

export async function GET(request: Request) {
  const platform = normalizePlatform(new URL(request.url).searchParams.get("platform"));
  const project = await getActiveProjectFromRequest(request);
  const contentFormats = await prisma.contentFormat.findMany({
    where: {
      projectId: project.id,
      platform
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      platform: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      products: {
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          id: true,
          contentFormatId: true,
          name: true,
          description: true,
          sellingPoints: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              assets: true
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
  const project = await getActiveProjectFromRequest(request);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content format payload" }, { status: 400 });
  }

  const contentFormat = await prisma.contentFormat.create({
    data: {
      projectId: project.id,
      platform: parsed.data.platform,
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
  const project = await getActiveProjectFromRequest(request);

  if (!id) {
    return NextResponse.json({ error: "Content format id is required" }, { status: 400 });
  }

  const assets = await prisma.productAsset.findMany({
    where: {
      product: {
        contentFormatId: id,
        contentFormat: {
          projectId: project.id
        }
      }
    },
    select: {
      id: true,
      imageUrl: true
    }
  });
  const assetIds = new Set(assets.map((asset) => asset.id));

  if (assetIds.size) {
    const tasks = await prisma.contentTask.findMany({
      where: {
        projectId: project.id,
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

  const result = await prisma.contentFormat.deleteMany({
    where: {
      id,
      projectId: project.id
    }
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Content format not found" }, { status: 404 });
  }

  await Promise.all(assets.map((asset) => removeProductAssetFile(asset.imageUrl)));

  return NextResponse.json({ ok: true });
}
