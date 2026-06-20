import { ProductAssetType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeProductImage } from "@/lib/ai/image-analyzer";
import { prisma } from "@/lib/prisma";

const analyzeSchema = z.object({
  productAssetId: z.string().min(1)
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = analyzeSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid image analysis payload" }, { status: 400 });
  }

  const asset = await prisma.productAsset.findUnique({
    where: {
      id: parsed.data.productAssetId
    },
    include: {
      product: {
        include: {
          contentFormat: true
        }
      }
    }
  });

  if (!asset || asset.type !== ProductAssetType.IMAGE || !asset.imageUrl) {
    return NextResponse.json({ error: "Image asset not found" }, { status: 404 });
  }

  const imageAnalysis = await analyzeProductImage({
    imageUrl: asset.imageUrl,
    productName: asset.product.name,
    contentFormatName: asset.product.contentFormat.name,
    hint: asset.content
  });
  const productAsset = await prisma.productAsset.update({
    where: {
      id: asset.id
    },
    data: {
      imageAnalysis
    }
  });

  return NextResponse.json({ productAsset, imageAnalysis });
}
