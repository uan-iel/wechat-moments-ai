import { ContentPlatform, ContentTaskStatus, ProductAssetType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeProductImage } from "@/lib/ai/image-analyzer";
import { generateMomentContent } from "@/lib/ai/content-generator";
import { buildResearchMemory } from "@/lib/ai/research-memory";
import { prisma } from "@/lib/prisma";
import { normalizePlatform } from "@/lib/platforms";

const generateContentSchema = z.object({
  contentTaskId: z.string().min(1).optional(),
  platform: z.enum(["MOMENTS", "XIAOHONGSHU"]).default("MOMENTS"),
  campaignGoal: z.string().min(1),
  contentFormatId: z.string().min(1),
  productId: z.string().min(1),
  selectedAssetIds: z.array(z.string().min(1)).optional(),
  referenceStyleId: z.string().min(1).optional(),
  wordCountRange: z.enum(["50-150", "150-250", "250-350", "350-450"]).default("150-250"),
  styleTags: z.array(z.string().min(1).max(20)).default([])
});

function formatProductInfo(product: {
  name: string;
  description: string | null;
  sellingPoints: string[];
}) {
  return [
    `产品名称：${product.name}`,
    `产品说明：${product.description || "无"}`,
    `产品关键词：${product.sellingPoints.join("、") || "无"}`
  ].join("\n");
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = generateContentSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content generation payload" }, { status: 400 });
  }

  try {
    const product = await prisma.product.findFirst({
      where: {
        id: parsed.data.productId,
        contentFormatId: parsed.data.contentFormatId,
        contentFormat: {
          platform: parsed.data.platform as ContentPlatform
        }
      },
      include: {
        contentFormat: true,
        assets: parsed.data.selectedAssetIds?.length
          ? {
              where: {
                id: {
                  in: parsed.data.selectedAssetIds
                }
              }
            }
          : true
      }
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const assets = await Promise.all(
      product.assets.map(async (asset) => {
        if (asset.type !== ProductAssetType.IMAGE || !asset.imageUrl || asset.imageAnalysis) {
          return asset;
        }

        const imageAnalysis = await analyzeProductImage({
          imageUrl: asset.imageUrl,
          productName: product.name,
          contentFormatName: product.contentFormat.name,
          hint: asset.content
        });

        return prisma.productAsset.update({
          where: {
            id: asset.id
          },
          data: {
            imageAnalysis
          }
        });
      })
    );
    const researchMemory =
      normalizePlatform(parsed.data.platform) === "XIAOHONGSHU"
        ? await buildResearchMemory({
            platform: parsed.data.platform,
            contentFormatName: product.contentFormat.name,
            productName: product.name,
            productKeywords: product.sellingPoints
          })
        : "无需加载研究洞察：这部分研究记忆只提供给小红书生成模块，朋友圈模块禁止读取。";
    const { generatedContent, relevantAssets } = await generateMomentContent({
      campaignGoal: parsed.data.campaignGoal,
      platform: parsed.data.platform,
      formatGuide: [
        `名称：${product.contentFormat.name}`,
        `说明：${product.contentFormat.description || "无"}`,
        `写作要求：${product.contentFormat.writingGuide || "无"}`
      ].join("\n"),
      productInfo: formatProductInfo(product),
      researchMemory,
      referenceStyleId: parsed.data.referenceStyleId,
      wordCountRange: parsed.data.wordCountRange,
      styleTags: parsed.data.styleTags.map((tag) => tag.trim()).filter(Boolean),
      assets: assets.map((asset) => ({
        id: asset.id,
        type: asset.type,
        title: asset.title,
        content: asset.content,
        imageUrl: asset.imageUrl,
        imageAnalysis: asset.imageAnalysis,
        tags: asset.tags
      }))
    });
    const imageUrls = relevantAssets
      .map((asset) => asset.imageUrl)
      .filter((url): url is string => Boolean(url));
    const selectedAssetIds = relevantAssets.map((asset) => asset.id);
    const contentTask = await prisma.contentTask.upsert({
      where: {
        id: parsed.data.contentTaskId ?? "__new_task__"
      },
      update: {
        title: parsed.data.campaignGoal,
        platform: parsed.data.platform,
        campaignGoal: parsed.data.campaignGoal,
        contentFormatId: product.contentFormatId,
        productId: product.id,
        selectedAssetIds,
        status: ContentTaskStatus.DRAFT
      },
      create: {
        title: parsed.data.campaignGoal,
        platform: parsed.data.platform,
        campaignGoal: parsed.data.campaignGoal,
        contentFormatId: product.contentFormatId,
        productId: product.id,
        selectedAssetIds,
        status: ContentTaskStatus.DRAFT
      }
    });
    const versionCount = await prisma.contentVersion.count({
      where: {
        taskId: contentTask.id
      }
    });
    const contentVersion = await prisma.contentVersion.create({
      data: {
        taskId: contentTask.id,
        label: versionCount === 0 ? "初稿" : `重新生成 v${versionCount + 1}`,
        content: generatedContent.trim(),
        imageUrls
      }
    });

    return NextResponse.json({
      contentTask,
      contentVersion,
      generatedContent,
      retrievedAssets: relevantAssets
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate content"
      },
      { status: 500 }
    );
  }
}
