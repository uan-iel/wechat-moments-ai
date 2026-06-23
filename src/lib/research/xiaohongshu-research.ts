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
  collectViewRatio: number | null;
  qualityScore: number;
};

const insightPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是一名擅长拆解小红书高表现内容的内容策略分析师。",
      "你的任务不是复述样本文案，而是提炼可迁移的方法论。",
      "你必须优先分析数据表现最好的笔记为什么表现好，再总结中低表现样本与它们的差异。",
      "你必须把高表现原因沉淀成后续写作可复用的底层记忆，而不是停留在表面总结。",
      "请从选题切口、开头方式、情绪路径、场景代入、结构节奏、互动引导几个维度分析。",
      "如果提供了数据指标，要优先解释高数据内容为什么表现更强，尤其关注高点赞、高收藏、高评论、高阅赞比、高阅评比和高阅藏比样本。",
      "请明确指出：哪些特点更容易带来高数据，哪些表达虽然常见但不值得重点学习。",
      "输出必须包含两部分：",
      "1. summary：200字以内总结这些内容的高表现规律，并明确说明高数据笔记最值得学习的原因。",
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

function averageMetric(notes: RankedResearchNote[], selector: (note: RankedResearchNote) => number) {
  if (notes.length === 0) {
    return 0;
  }

  return notes.reduce((sum, note) => sum + selector(note), 0) / notes.length;
}

function formatPercent(value: number | null) {
  return value !== null && Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "无";
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
        commentViewRatio: viewCount > 0 ? commentCount / viewCount : null,
        collectViewRatio: viewCount > 0 ? collectCount / viewCount : null,
        qualityScore:
          likeCount +
          collectCount * 2.8 +
          commentCount * 2.6 +
          shareCount * 1.8 +
          (viewCount > 0 ? likeCount / viewCount : 0) * 600 +
          (viewCount > 0 ? commentCount / viewCount : 0) * 900 +
          (viewCount > 0 ? collectCount / viewCount : 0) * 750
      };
    })
    .sort((left, right) => right.qualityScore - left.qualityScore || right.engagementScore - left.engagementScore);
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

function buildPerformanceSnapshot(notes: RankedResearchNote[]) {
  const topNotes = notes.slice(0, Math.min(3, notes.length));
  const baselineNotes = notes.slice(Math.max(0, notes.length - Math.min(3, notes.length)));

  return [
    "高表现样本优先观察：",
    ...topNotes.map((note, index) =>
      [
        `高表现 ${index + 1}`,
        `- 标题：${note.title || "无标题"}`,
        `- 点赞/评论/收藏/分享/浏览：${normalizeMetric(note.likeCount)}/${normalizeMetric(note.commentCount)}/${normalizeMetric(note.collectCount)}/${normalizeMetric(note.shareCount)}/${normalizeMetric(note.viewCount)}`,
        `- 阅赞比：${formatPercent(note.likeViewRatio)}`,
        `- 阅评比：${formatPercent(note.commentViewRatio)}`,
        `- 阅藏比：${formatPercent(note.collectViewRatio)}`,
        `- 关键词：${note.keywords.join("、") || "无"}`
      ].join("\n")
    ),
    "高表现 vs 低表现数据差异：",
    `- 高表现平均阅赞比：${formatPercent(averageMetric(topNotes, (note) => note.likeViewRatio ?? 0))}；低表现平均阅赞比：${formatPercent(averageMetric(baselineNotes, (note) => note.likeViewRatio ?? 0))}`,
    `- 高表现平均阅评比：${formatPercent(averageMetric(topNotes, (note) => note.commentViewRatio ?? 0))}；低表现平均阅评比：${formatPercent(averageMetric(baselineNotes, (note) => note.commentViewRatio ?? 0))}`,
    `- 高表现平均阅藏比：${formatPercent(averageMetric(topNotes, (note) => note.collectViewRatio ?? 0))}；低表现平均阅藏比：${formatPercent(averageMetric(baselineNotes, (note) => note.collectViewRatio ?? 0))}`
  ].join("\n");
}

function buildSampleText(collectionName: string, scopeKey: string, notes: RankedResearchNote[]) {
  return [
    buildPerformanceSnapshot(notes),
    "",
    "详细样本：",
    notes
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
        note.collectViewRatio ? `- 阅藏比：${(note.collectViewRatio * 100).toFixed(2)}%` : null,
        `- 主题归属：${scopeKey || collectionName}`
      ]
        .filter(Boolean)
        .join("\n")
    )
      .join("\n\n---\n\n")
  ].join("\n");
}

function fallbackInsight(notes: RankedResearchNote[]) {
  const topKeywords = collectTopKeywords(notes);
  const top = notes.slice(0, 3);
  const averageLikeView = averageMetric(top, (note) => note.likeViewRatio ?? 0);
  const averageCommentView = averageMetric(top, (note) => note.commentViewRatio ?? 0);
  const averageCollectView = averageMetric(top, (note) => note.collectViewRatio ?? 0);
  const summary = [
    "高数据样本更集中在强场景切入、短句开头、先抛情绪或结果再展开细节的写法。",
    `表现最好的几篇平均阅赞比约 ${formatPercent(averageLikeView)}、阅评比约 ${formatPercent(averageCommentView)}、阅藏比约 ${formatPercent(averageCollectView)}，说明它们更容易让读者产生停留、共鸣和收藏动机。`,
    "这些内容通常没有先讲参数，而是先给读者一个明确情境、情绪钩子或关系画面，再把产品自然带进去。",
    "真正值得学习的是开头抓力、代入路径、互动余味和收藏价值，而不是表面句式。"
  ].join("");
  const recommendations = [
    "1) 先拆高数据笔记的第一屏：它是靠结果感、情绪冲突还是具体场景把人留下来的，后续写作优先复用这种开头机制。",
    "2) 正文用 2 到 4 个短段推进，把体验、关系变化和使用场景交替展开，让读者自然走到收藏或评论动作。",
    "3) 卖点不要平铺罗列，而要用“为什么这个情境下它刚好有用”来带出，这类写法更容易拿到高互动。",
    "4) 结尾保留轻互动、轻收藏、轻咨询，并给读者一个值得回应或顺手保存的理由。"
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
