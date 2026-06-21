import { ProductAssetType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const productAssetSchema = z.object({
  productId: z.string().min(1),
  type: z.nativeEnum(ProductAssetType).default(ProductAssetType.TEXT),
  title: z.string().optional(),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
  tags: z.array(z.string()).default([])
});

export async function GET() {
  const productAssets = await prisma.productAsset.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    include: {
      product: {
        include: {
          contentFormat: true
        }
      }
    }
  });

  return NextResponse.json({ productAssets });
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = productAssetSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product asset payload" }, { status: 400 });
  }

  if (parsed.data.type === ProductAssetType.IMAGE && !parsed.data.imageUrl?.trim()) {
    return NextResponse.json({ error: "图片素材需要填写图片链接" }, { status: 400 });
  }

  if (parsed.data.type === ProductAssetType.TEXT && !parsed.data.content?.trim()) {
    return NextResponse.json({ error: "文本素材需要填写内容" }, { status: 400 });
  }

  const productAsset = await prisma.productAsset.create({
    data: {
      productId: parsed.data.productId,
      type: parsed.data.type,
      title: parsed.data.title?.trim() || null,
      content: parsed.data.content?.trim() || null,
      imageUrl: parsed.data.imageUrl?.trim() || null,
      tags: parsed.data.tags.map((tag) => tag.trim()).filter(Boolean)
    }
  });

  return NextResponse.json({ productAsset }, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Product asset id is required" }, { status: 400 });
  }

  const tasks = await prisma.contentTask.findMany({
    where: {
      selectedAssetIds: {
        has: id
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
          selectedAssetIds: task.selectedAssetIds.filter((assetId) => assetId !== id)
        }
      })
    )
  );

  await prisma.productAsset.delete({
    where: {
      id
    }
  });

  return NextResponse.json({ ok: true });
}
