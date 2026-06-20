import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeMomentStyle } from "@/lib/ai/style-analyzer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const analyzeStyleSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  sourceText: z.string().min(20)
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = analyzeStyleSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "请粘贴至少 20 个字符的历史朋友圈文案。" }, { status: 400 });
  }

  try {
    const analysisPrompt = await analyzeMomentStyle(parsed.data.sourceText.trim());
    const nowLabel = new Date().toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit"
    });

    const styleProfile = await prisma.styleProfile.create({
      data: {
        name: parsed.data.name?.trim() || `系统学习-${nowLabel}风格`,
        description: parsed.data.description?.trim() || "由手动粘贴的历史文案分析生成",
        analysisPrompt: analysisPrompt.trim(),
        sourceText: parsed.data.sourceText.trim()
      }
    });

    return NextResponse.json({ styleProfile }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze style" },
      { status: 500 }
    );
  }
}
