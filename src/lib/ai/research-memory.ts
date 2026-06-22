import { ContentPlatform } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizePlatform } from "@/lib/platforms";

function tokenize(value: string) {
  const normalized = value.toLowerCase();
  const asciiTokens: string[] = normalized.match(/[a-z0-9]+/g) ?? [];
  const cjkTokens: string[] = normalized.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];

  return asciiTokens.concat(cjkTokens).map((token) => token.trim()).filter(Boolean);
}

function overlapScore(referenceTokens: string[], candidateText: string) {
  if (referenceTokens.length === 0) {
    return 0;
  }

  const candidate = candidateText.toLowerCase();
  return referenceTokens.reduce((score, token) => score + (candidate.includes(token) ? 1 : 0), 0);
}

export async function buildResearchMemory(input: {
  platform?: "MOMENTS" | "XIAOHONGSHU";
  contentFormatName?: string;
  productName?: string;
  productKeywords?: string[];
}) {
  if (normalizePlatform(input.platform) !== "XIAOHONGSHU") {
    return "无需加载研究洞察：这部分研究记忆只提供给小红书生成模块，朋友圈模块禁止读取。";
  }

  const platform = ContentPlatform.XIAOHONGSHU;
  const candidateInsights = await prisma.researchInsight.findMany({
    where: {
      platform
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 12
  });

  if (candidateInsights.length === 0) {
    return "暂无小红书研究洞察，优先依赖本地文案记忆与产品信息。";
  }

  const referenceTokens = tokenize(
    [input.contentFormatName, input.productName, ...(input.productKeywords ?? [])].filter(Boolean).join(" ")
  );
  const ranked = candidateInsights
    .map((insight, index) => {
      const text = [
        insight.scopeKey,
        insight.title,
        insight.summary,
        insight.recommendations,
        insight.topKeywords.join(" ")
      ]
        .filter(Boolean)
        .join("\n");

      return {
        insight,
        score: overlapScore(referenceTokens, text) * 10 + (candidateInsights.length - index)
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ insight }) => insight);

  return ranked
    .map((insight, index) =>
      [
        `研究洞察 ${index + 1}：${insight.title}`,
        `- 适用关键词：${insight.topKeywords.join("、") || insight.scopeKey || "泛平台"}`,
        `- 结论：${insight.summary}`,
        insight.recommendations ? `- 写作建议：${insight.recommendations}` : null
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}
