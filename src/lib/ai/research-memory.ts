import { ContentPlatform } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizePlatform } from "@/lib/platforms";

const GENERIC_RESEARCH_TOKENS = new Set([
  "产品",
  "文案",
  "内容",
  "小红书",
  "笔记",
  "推荐",
  "好物",
  "种草",
  "礼物",
  "送礼",
  "创意礼物",
  "生日礼物",
  "闺蜜礼物"
]);

function tokenize(value: string) {
  const normalized = value.toLowerCase();
  const asciiTokens: string[] = normalized.match(/[a-z0-9]+/g) ?? [];
  const cjkTokens: string[] = normalized.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  const cjkBigrams = cjkTokens.flatMap((token) => {
    if (token.length <= 2) {
      return [token];
    }

    return Array.from({ length: token.length - 1 }, (_, index) => token.slice(index, index + 2));
  });

  return Array.from(new Set(asciiTokens.concat(cjkTokens, cjkBigrams)))
    .map((token) => token.trim())
    .filter((token) => token && !GENERIC_RESEARCH_TOKENS.has(token));
}

function overlapScore(referenceTokens: string[], candidateText: string) {
  if (referenceTokens.length === 0) {
    return 0;
  }

  const candidate = candidateText.toLowerCase();
  return referenceTokens.reduce((score, token) => score + (candidate.includes(token) ? 1 : 0), 0);
}

type ResearchMemoryInput = {
  platform?: "MOMENTS" | "XIAOHONGSHU";
  projectId?: string;
  contentFormatName?: string;
  productName?: string;
  productKeywords?: string[];
  campaignGoal?: string;
};

export type AppliedResearchInsight = {
  id: string;
  title: string;
  scopeKey: string | null;
  summary: string;
  recommendations: string | null;
  topKeywords: string[];
  updatedAt: string;
  overlap: number;
};

export async function resolveResearchMemory(input: ResearchMemoryInput) {
  if (normalizePlatform(input.platform) !== "XIAOHONGSHU") {
    return {
      text: "无需加载研究洞察：这部分研究记忆只提供给小红书生成模块，朋友圈模块禁止读取。",
      insights: [] as AppliedResearchInsight[]
    };
  }

  const platform = ContentPlatform.XIAOHONGSHU;
  const candidateInsights = await prisma.researchInsight.findMany({
    where: {
      platform,
      ...(input.projectId ? { projectId: input.projectId } : {})
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 12
  });

  if (candidateInsights.length === 0) {
    return {
      text: "暂无小红书研究洞察，优先依赖本地文案记忆与产品信息。",
      insights: [] as AppliedResearchInsight[]
    };
  }

  const referenceTokens = tokenize(
    [input.campaignGoal, input.contentFormatName, input.productName, ...(input.productKeywords ?? [])]
      .filter(Boolean)
      .join(" ")
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
        overlap: overlapScore(referenceTokens, text),
        score: overlapScore(referenceTokens, text) * 12 + (candidateInsights.length - index)
      };
    })
    .filter((item) => (referenceTokens.length > 0 ? item.overlap > 0 : false))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  if (ranked.length === 0) {
    return {
      text: "当前没有和本次主题直接相关的小红书研究洞察，优先依赖当前产品、图片特征和平台底层文风记忆生成。",
      insights: [] as AppliedResearchInsight[]
    };
  }

  return {
    text: ranked
      .map(({ insight }, index) =>
      [
        `研究洞察 ${index + 1}：${insight.title}`,
        `- 适用关键词：${insight.topKeywords.join("、") || insight.scopeKey || "泛平台"}`,
        `- 结论：${insight.summary}`,
        insight.recommendations ? `- 写作建议：${insight.recommendations}` : null
      ]
        .filter(Boolean)
        .join("\n")
    )
      .join("\n\n"),
    insights: ranked.map(({ insight, overlap }) => ({
      id: insight.id,
      title: insight.title,
      scopeKey: insight.scopeKey,
      summary: insight.summary,
      recommendations: insight.recommendations,
      topKeywords: insight.topKeywords,
      updatedAt: insight.updatedAt.toISOString(),
      overlap
    }))
  };
}

export async function buildResearchMemory(input: ResearchMemoryInput) {
  const resolved = await resolveResearchMemory(input);

  return resolved.text;
}
