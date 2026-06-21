import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const productSchema = z.object({
  contentFormatId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  sellingPoints: z.array(z.string()).default([])
});

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    include: {
      contentFormat: true,
      assets: {
        orderBy: {
          updatedAt: "desc"
        }
      }
    }
  });

  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = productSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product payload" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      contentFormatId: parsed.data.contentFormatId,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      sellingPoints: parsed.data.sellingPoints.map((item) => item.trim()).filter(Boolean)
    },
    include: {
      contentFormat: true,
      assets: true
    }
  });

  return NextResponse.json({ product }, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Product id is required" }, { status: 400 });
  }

  const assets = await prisma.productAsset.findMany({
    where: {
      productId: id
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

  await prisma.product.delete({
    where: {
      id
    }
  });

  return NextResponse.json({ ok: true });
}
