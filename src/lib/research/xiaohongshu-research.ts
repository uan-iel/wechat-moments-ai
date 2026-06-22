import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { createChatModel, isAiApiKeyConfigured } from "@/lib/ai/model-config";

export type XiaohongshuResearchNote = {
  id: string;
  title: string | null;
  content: string;
  authorName: string | null;
  noteUrl: string | null;
  publishedAt: Date | null;
  keywords: string[];
  likeCount: number | null;
  commentCount: number | null;
  collectCount: number | null;
  shareCount: number | null;
  viewCount: number | null;
};

export type RankedResearchNote = XiaohongshuResearchNote & {
  engagementScore: number;
  likeViewRatio: number | null;
  commentViewRatio: number | null;
};

const insightPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是一名擅长拆解小红书高表现内容的内容策略分析师。",
      "你的任务不是复述样本文案，而是提炼可迁移的方法论。",
      "请从选题切口、开头方式、情绪路径、场景代入、结构节奏、互动引导几个维度分析。",
      "如果提供了数据指标，要优先解释高数据内容为什么表现更强。",
      "输出必须包含两部分：",
      "1. summary：200字以内总结这些内容的高表现规律。",
      "2. recommendations：给运营写手的 4 条可执行写法建议，用“1)”开头依次列出。",
      "不要输出 JSON，不要复述原文句子。"
    ].join("\n")
  ],
  [
    "human",
    "研究主题：{collectionName}\n适用范围：{scopeKey}\n\n样本摘要：\n{sampleText}\n\n请输出 summary 和 recommendations。"
  ]
]);

function normalizeMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function rankResearchNotes(notes: XiaohongshuResearchNote[]) {
  return notes
    .map((note) => {
      const likeCount = normalizeMetric(note.likeCount);
      const commentCount = normalizeMetric(note.commentCount);
      const collectCount = normalizeMetric(note.collectCount);
      const shareCount = normalizeMetric(note.shareCount);
      const viewCount = normalizeMetric(note.viewCount);

      return {
        ...note,
        engagementScore: likeCount + commentCount * 2.4 + collectCount * 2.1 + shareCount * 1.6,
        likeViewRatio: viewCount > 0 ? likeCount / viewCount : null,
        commentViewRatio: viewCount > 0 ? commentCount / viewCount : null
      };
    })
    .sort((left, right) => right.engagementScore - left.engagementScore);
}

export function collectTopKeywords(notes: RankedResearchNote[]) {
  const counts = new Map<string, number>();

  for (const note of notes) {
    for (const keyword of note.keywords) {
      const cleaned = keyword.trim();

      if (!cleaned) {
        continue;
      }

      counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([keyword]) => keyword);
}

function buildSampleText(collectionName: string, scopeKey: string, notes: RankedResearchNote[]) {
  return notes
    .slice(0, 8)
    .map((note, index) =>
      [
        `样本 ${index + 1}`,
        `- 标题：${note.title || "无标题"}`,
        `- 内容摘要：${note.content.slice(0, 240)}`,
        `- 关键词：${note.keywords.join("、") || "无"}`,
        `- 点赞/评论/收藏/分享：${normalizeMetric(note.likeCount)}/${normalizeMetric(note.commentCount)}/${normalizeMetric(note.collectCount)}/${normalizeMetric(note.shareCount)}`,
        note.viewCount ? `- 浏览量：${note.viewCount}` : null,
        note.likeViewRatio ? `- 阅赞比：${(note.likeViewRatio * 100).toFixed(2)}%` : null,
        note.commentViewRatio ? `- 阅评比：${(note.commentViewRatio * 100).toFixed(2)}%` : null,
        `- 主题归属：${scopeKey || collectionName}`
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n---\n\n");
}

function fallbackInsight(notes: RankedResearchNote[]) {
  const topKeywords = collectTopKeywords(notes);
  const top = notes.slice(0, 3);
  const summary = [
    "高表现样本更集中在强场景切入、短句开头、先抛情绪或结果再展开细节的写法。",
    "互动数据更好的内容通常没有先讲参数，而是先给读者一个关系场景、送礼场景或真实感受。",
    "结尾多为轻互动或轻收藏提醒，而不是直接硬转化。"
  ].join("");
  const recommendations = [
    "1) 开头先给结果感、情绪感或具体场景，不要直接介绍产品。",
    "2) 正文用 2 到 4 个短段推进，把体验、关系变化和使用场景交替展开。",
    "3) 卖点通过结果感和代入感带出，避免参数堆叠。",
    "4) 结尾保留轻互动、轻收藏、轻咨询，而不是强行催单。"
  ].join("\n");

  return {
    title: `${topKeywords[0] || "小红书"}主题高表现写法`,
    summary,
    recommendations,
    topKeywords
  };
}

export async function analyzeXiaohongshuResearch(input: {
  collectionName: string;
  scopeKey: string;
  notes: XiaohongshuResearchNote[];
}) {
  const ranked = rankResearchNotes(input.notes);
  const topKeywords = collectTopKeywords(ranked);

  if (ranked.length === 0) {
    return {
      title: `${input.collectionName} 研究洞察`,
      summary: "暂无可分析样本。",
      recommendations: "1) 先导入至少 1 条可读的小红书样本。",
      topKeywords: []
    };
  }

  const aiReady = await isAiApiKeyConfigured().catch(() => false);

  if (!aiReady) {
    return fallbackInsight(ranked);
  }

  try {
    const chain = insightPrompt.pipe(await createChatModel({ temperature: 0.2 })).pipe(new StringOutputParser());
    const response = await chain.invoke({
      collectionName: input.collectionName,
      scopeKey: input.scopeKey || "泛平台",
      sampleText: buildSampleText(input.collectionName, input.scopeKey, ranked)
    });
    const [summaryPart, ...rest] = response.split(/recommendations[:：]/i);
    const summary = summaryPart.replace(/^summary[:：]/i, "").trim();
    const recommendations = rest.join("recommendations：").trim() || fallbackInsight(ranked).recommendations;

    return {
      title: `${input.scopeKey || input.collectionName} 高表现写法`,
      summary: summary || fallbackInsight(ranked).summary,
      recommendations,
      topKeywords
    };
  } catch {
    return fallbackInsight(ranked);
  }
}
