import { ContentPlatform } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveResearchMemory } from "@/lib/ai/research-memory";
import { prisma } from "@/lib/prisma";
import { getActiveProjectFromRequest } from "@/lib/projects";

const previewSchema = z.object({
  platform: z.enum(["MOMENTS", "XIAOHONGSHU"]).default("XIAOHONGSHU"),
  campaignGoal: z.string().optional(),
  contentFormatId: z.string().min(1),
  productId: z.string().min(1)
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = previewSchema.safeParse(body);
  const project = await getActiveProjectFromRequest(request);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid research preview payload" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: {
      id: parsed.data.productId,
      contentFormatId: parsed.data.contentFormatId,
      contentFormat: {
        projectId: project.id,
        platform: parsed.data.platform as ContentPlatform
      }
    },
    include: {
      contentFormat: true
    }
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const resolved = await resolveResearchMemory({
    platform: parsed.data.platform,
    projectId: project.id,
    campaignGoal: parsed.data.campaignGoal,
    contentFormatName: product.contentFormat.name,
    productName: product.name,
    productKeywords: product.sellingPoints
  });

  return NextResponse.json({
    insights: resolved.insights,
    researchMemory: resolved.text
  });
}
