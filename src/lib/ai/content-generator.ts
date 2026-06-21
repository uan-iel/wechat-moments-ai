import { Document } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

import { createChatModel, createEmbeddingModel, getAiModelConfig } from "@/lib/ai/model-config";
import { normalizePlatform } from "@/lib/platforms";

export type ProductAssetForGeneration = {
  id: string;
  type: "TEXT" | "IMAGE" | "text" | "image";
  title?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  imageAnalysis?: string | null;
  tags: string[];
};

export type RetrievedProductAsset = ProductAssetForGeneration & {
  score?: number;
};

type RankedProductAsset = RetrievedProductAsset & {
  rankScore?: number;
  tokens?: Set<string>;
  signals?: ReturnType<typeof candidateSignals>;
};

const contentPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是一个专业的社交平台原创文案写手。",
      "你的首要目标不是改写历史素材，而是基于检索到的信号生成全新表达。",
      "铁律：检索素材只允许提取产品参数、使用场景和用户情绪这三类信息；必须使用与素材完全不同的句式结构和比喻方式来重写；严禁拼接、复述、仿写或套用原句。",
      "如果检索素材出现明显相似表达，你必须主动换角度、换结构、换节奏。",
      "输出必须像一个真正原创的新平台文案，而不是旧素材的整理版。"
    ].join("\n")
  ],
  [
    "human",
    "目标平台：{platformLabel}\n平台要求：\n{platformInstruction}\n\n内容形式：\n{formatGuide}\n\n产品信息：\n{productInfo}\n\n已选素材与图片特征：\n{assetContent}\n\n文案目标：{campaignGoal}\n\n生成控制：\n- 字数区间：{wordCountRange} 字\n- 风格标签：{styleInstruction}\n\n要求：\n1. 文案必须适合目标平台手动发布，语气自然可信。\n2. 必须结合产品卖点和图片特征，不要凭空编造未提供的信息。\n3. 如果图片分析里有外观、材质、场景、质感等特征，要把精华自然融入文案。\n4. 必须严格对标风格标签；多个标签同时存在时要融合，而不是分段解释。\n5. 字数必须落在指定区间内，不要明显超出或低于范围。\n6. 可适度使用 emoji，但不要堆砌。\n7. 包含一个温和的行动引导。\n8. 只输出正文，不解释创作过程。"
  ]
]);

const xiaohongshuTitlePrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是一个擅长小红书笔记标题的内容策划。",
      "你只能输出 1 行标题，不要输出正文、序号、引号、解释或标签。",
      "标题要有记忆点、场景感或结果感，但不能夸张、不能像硬广、不能标题党。"
    ].join("\n")
  ],
  [
    "human",
    "内容形式：\n{formatGuide}\n\n产品信息：\n{productInfo}\n\n素材信号：\n{assetContent}\n\n文案目标：{campaignGoal}\n\n风格标签：\n{styleInstruction}\n\n请为这篇小红书图文笔记写一个标题，控制在 12 到 24 个汉字之间，只输出标题。"
  ]
]);

function buildPlatformInstruction(platform?: "MOMENTS" | "XIAOHONGSHU") {
  if (normalizePlatform(platform) === "XIAOHONGSHU") {
    return [
      "适合小红书图文笔记：开头要更抓人，但不能夸张到像硬广或标题党。",
      "建议使用“短标题感开头 + 2 到 4 段正文”的组织方式，段落不要太厚。",
      "正文要有体验感、场景感和种草感，让读者能迅速代入“这东西适不适合我”。",
      "自然埋入 3 到 6 个高价值关键词，优先来自品类、材质、使用场景、核心卖点、情绪感受，不要堆 hashtag。",
      "结尾更适合用轻互动、轻收藏、轻询问式收尾，比如引导评论、收藏或私聊了解。",
      "允许有一点平台网感，但不要生硬追热点。"
    ].join("\n");
  }

  return [
    "适合朋友圈发布：像真实人在日常分享，不要像正式广告。",
    "整体更自然、更连贯，避免标题党和刻意分段感。",
    "重点是可信、顺口、像熟人之间会发出来的内容。"
  ].join("\n");
}

function parseWordCountRange(range?: string) {
  const match = range?.match(/(\d+)\s*-\s*(\d+)/);

  if (!match) {
    return { min: 150, max: 250 };
  }

  return {
    min: Number(match[1]),
    max: Number(match[2])
  };
}

function deriveBodyWordCountRange(range?: string) {
  const { min, max } = parseWordCountRange(range);
  const reducedMin = Math.max(40, min - 20);
  const reducedMax = Math.max(reducedMin + 20, max - 20);

  return `${reducedMin}-${reducedMax}`;
}

function combineXiaohongshuContent(title: string, body: string) {
  const cleanTitle = title.trim().replace(/^["'“”‘’#\s]+|["'“”‘’#\s]+$/g, "");
  const cleanBody = body.trim();

  return cleanTitle ? `${cleanTitle}\n\n${cleanBody}` : cleanBody;
}

function assetToDocument(item: ProductAssetForGeneration) {
  return new Document({
    pageContent: [
      `素材标题：${item.title || "未命名"}`,
      `素材类型：${String(item.type).toUpperCase() === "IMAGE" ? "图片" : "文本"}`,
      `标签：${item.tags.join(", ") || "无"}`,
      `图片：${item.imageUrl || "无"}`,
      `图片分析：${item.imageAnalysis || "无"}`,
      `内容：${item.content || "无"}`
    ].join("\n"),
    metadata: {
      id: item.id,
      type: item.type,
      tags: item.tags
    }
  });
}

function tokenize(value: string) {
  const normalized = value.toLowerCase();
  const asciiTokens: string[] = normalized.match(/[a-z0-9]+/g) ?? [];
  const cjkTokens: string[] = normalized.match(/[\u4e00-\u9fa5]+/g) ?? [];
  const cjkChars = cjkTokens.join("").split("");

  return asciiTokens.concat(cjkTokens, cjkChars).map((token) => token.trim()).filter(Boolean);
}

function scoreAsset(campaignGoal: string, item: ProductAssetForGeneration) {
  const goalTokens = tokenize(campaignGoal);
  const itemText = [item.title, item.content, item.imageAnalysis, item.tags.join(" "), item.imageUrl]
    .filter(Boolean)
    .join(" ");
  const itemLower = itemText.toLowerCase();
  const tokenScore = goalTokens.reduce((score, token) => score + (itemLower.includes(token) ? 2 : 0), 0);
  const directScore = itemLower.includes(campaignGoal.toLowerCase()) ? 5 : 0;

  return tokenScore + directScore;
}

function keywordRetrieve(input: {
  campaignGoal: string;
  assets: ProductAssetForGeneration[];
  limit: number;
}) {
  return input.assets
    .map((item, index) => ({
      ...item,
      score: scoreAsset(input.campaignGoal, item) - index / 1000
    }))
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, input.limit);
}

function normalizedType(type: ProductAssetForGeneration["type"]) {
  return String(type).toUpperCase() === "IMAGE" ? "IMAGE" : "TEXT";
}

function similarityTokens(item: ProductAssetForGeneration) {
  return new Set(
    tokenize([item.title, item.content, item.imageAnalysis, item.tags.join(" "), item.imageUrl].filter(Boolean).join(" "))
      .filter((token) => token.length > 1)
  );
}

function jaccardSimilarity(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of Array.from(left)) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function candidateSignals(item: ProductAssetForGeneration) {
  const text = [item.title, item.content, item.imageAnalysis, item.tags.join(" "), item.imageUrl].filter(Boolean).join(" ");
  const parameterKeywords = ["参数", "规格", "尺寸", "容量", "重量", "材质", "颜色", "版本", "功能", "卖点", "价格", "套餐", "工艺", "口味", "香型"];
  const sceneKeywords = ["聚会", "送礼", "办公", "通勤", "旅行", "露营", "家庭", "生日", "节日", "周末", "客户", "朋友", "孩子", "桌游", "家居", "开学", "婚礼", "社群", "朋友圈"];
  const emotionKeywords = ["轻松", "安心", "省心", "有面子", "高级", "治愈", "温暖", "惊喜", "热闹", "松弛", "快乐", "仪式感", "走心", "陪伴", "共鸣", "体面", "质感", "氛围"];

  const matched = [...parameterKeywords, ...sceneKeywords, ...emotionKeywords].filter((keyword) => text.includes(keyword));

  return {
    parameters: parameterKeywords.filter((keyword) => text.includes(keyword)),
    scenes: sceneKeywords.filter((keyword) => text.includes(keyword)),
    emotions: emotionKeywords.filter((keyword) => text.includes(keyword)),
    keywords: Array.from(new Set([...matched, ...item.tags.filter(Boolean)]))
  };
}

function pruneNearDuplicates(candidates: RankedProductAsset[]) {
  const kept: RankedProductAsset[] = [];

  for (const candidate of candidates) {
    const candidateTokens = similarityTokens(candidate);
    const isDuplicate = kept.some((existing) => {
      const existingTokens = similarityTokens(existing);
      const similarity = jaccardSimilarity(candidateTokens, existingTokens);
      const sameType = normalizedType(candidate.type) === normalizedType(existing.type);
      const sameTags =
        candidate.tags.length > 0 &&
        existing.tags.length > 0 &&
        candidate.tags.some((tag) => existing.tags.includes(tag));

      return similarity >= 0.78 && sameType && sameTags;
    });

    if (!isDuplicate) {
      kept.push(candidate);
    }
  }

  return kept;
}

function selectDiverseAssets(candidates: RetrievedProductAsset[], limit: number) {
  const ranked = (candidates.map((item, index) => ({
    ...item,
    rankScore: typeof item.score === "number" ? item.score : candidates.length - index,
    tokens: similarityTokens(item),
    signals: candidateSignals(item)
  })) as RankedProductAsset[]).sort((left, right) => (right.rankScore ?? 0) - (left.rankScore ?? 0));
  const deduped = pruneNearDuplicates(ranked);
  const selected: typeof ranked = [];
  const remaining = [...deduped];

  while (selected.length < limit && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    remaining.forEach((candidate, index) => {
      const relevance = (candidate.rankScore ?? 0) / Math.max(1, ranked.length);
      const similarityPenalty = selected.length
        ? Math.max(...selected.map((picked) => jaccardSimilarity(candidate.tokens ?? new Set(), picked.tokens ?? new Set())))
        : 0;
      const typePenalty = selected.some((picked) => normalizedType(picked.type) === normalizedType(candidate.type)) ? 0.08 : 0;
      const tagOverlapPenalty = selected.some((picked) =>
        candidate.tags.some((tag) => picked.tags.includes(tag))
      )
        ? 0.05
        : 0;
      const noveltySignals = new Set([
        ...(candidate.signals?.parameters ?? []),
        ...(candidate.signals?.scenes ?? []),
        ...(candidate.signals?.emotions ?? [])
      ]);
      const seenSignals = new Set(
        selected.flatMap((picked) => [
          ...(picked.signals?.parameters ?? []),
          ...(picked.signals?.scenes ?? []),
          ...(picked.signals?.emotions ?? [])
        ])
      );
      let freshSignalCount = 0;
      for (const signal of Array.from(noveltySignals)) {
        if (!seenSignals.has(signal)) {
          freshSignalCount += 1;
        }
      }

      const noveltyBoost = Math.min(0.12, freshSignalCount * 0.03);
      const score = relevance + noveltyBoost - similarityPenalty * 0.72 - typePenalty - tagOverlapPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    const [chosen] = remaining.splice(bestIndex, 1);
    selected.push(chosen);
  }

  return selected.map(({ tokens, signals, rankScore, ...item }) => item);
}

export async function retrieveRelevantAssets(input: {
  campaignGoal: string;
  assets: ProductAssetForGeneration[];
  limit?: number;
}) {
  const limit = input.limit ?? 6;
  const candidateLimit = Math.min(input.assets.length, Math.max(limit * 4, limit + 4));

  if (input.assets.length <= limit) {
    return selectDiverseAssets(
      input.assets.map((asset, index) => ({
        ...asset,
        score: input.assets.length - index
      })),
      input.assets.length
    );
  }

  const config = await getAiModelConfig();

  if (!config.embedding.model) {
    return selectDiverseAssets(keywordRetrieve({
      campaignGoal: input.campaignGoal,
      assets: input.assets,
      limit: candidateLimit
    }), limit);
  }

  const vectorStore = await MemoryVectorStore.fromDocuments(
    input.assets.map(assetToDocument),
    await createEmbeddingModel()
  );
  const results = await vectorStore.similaritySearchWithScore(input.campaignGoal, candidateLimit);
  const rankedCandidates = results.map(([document, score]) => {
    const source = input.assets.find((item) => item.id === document.metadata.id);

    return {
      ...(source ?? {
        id: String(document.metadata.id),
        type: String(document.metadata.type) as ProductAssetForGeneration["type"],
        title: null,
        tags: Array.isArray(document.metadata.tags) ? document.metadata.tags : [],
        imageUrl: null,
        imageAnalysis: null,
        content: document.pageContent
      }),
      score: typeof score === "number" ? score : undefined
    };
  });

  return selectDiverseAssets(rankedCandidates, limit);
}

function extractDistinctSignals(item: ProductAssetForGeneration) {
  const signals = candidateSignals(item);
  const parameterText = signals.parameters.length ? signals.parameters.join(" / ") : "无明确参数";
  const sceneText = signals.scenes.length ? signals.scenes.join(" / ") : "无明确场景";
  const emotionText = signals.emotions.length ? signals.emotions.join(" / ") : "无明确情绪";
  const tagText = item.tags.length ? item.tags.join(" / ") : "无标签";
  const visualText = item.imageAnalysis?.trim() || "无图片分析";

  return [
    `素材${item.id}`,
    `- 产品参数：${parameterText}`,
    `- 使用场景：${sceneText}`,
    `- 用户情绪：${emotionText}`,
    `- 标签：${tagText}`,
    `- 图片特征：${visualText}`
  ].join("\n");
}

function buildStyleInstruction(styleTags: string[]) {
  const normalizedTags = Array.from(new Set(styleTags.map((tag) => tag.trim()).filter(Boolean)));

  if (normalizedTags.length === 0) {
    return "自然、清晰、不过度营销";
  }

  const styleGuide: Record<string, string> = {
    "活泼": "语气更有生命力，节奏轻快，可以有轻微俏皮感，但不要吵闹",
    "简约": "表达克制、句子干净、信息密度高，减少铺垫和形容词",
    "网感": "贴近日常社交平台语感，可以有自然口语和轻微梗感，但不要生硬追热点",
    "温柔": "语气柔和、有陪伴感，强调细腻感受和情绪安放"
  };

  return normalizedTags
    .map((tag) => `${tag}：${styleGuide[tag] || `请理解为一种“${tag}”取向，并落实到语气、节奏、词汇和画面感中`}`)
    .join("\n");
}

export async function generateMomentContent(input: {
  platform?: "MOMENTS" | "XIAOHONGSHU";
  campaignGoal: string;
  formatGuide: string;
  productInfo: string;
  wordCountRange?: string;
  styleTags?: string[];
  assets: ProductAssetForGeneration[];
}) {
  const relevantAssets = await retrieveRelevantAssets({
    campaignGoal: input.campaignGoal,
    assets: input.assets,
    limit: 8
  });
  const assetContent = relevantAssets
    .map((item) => extractDistinctSignals(item))
    .join("\n\n---\n\n");
  const model = await createChatModel({ temperature: 0.75 });
  const chain = contentPrompt.pipe(model).pipe(new StringOutputParser());
  const platform = normalizePlatform(input.platform);
  const basePromptInput = {
    platformLabel: normalizePlatform(input.platform) === "XIAOHONGSHU" ? "小红书" : "朋友圈",
    platformInstruction: buildPlatformInstruction(input.platform),
    campaignGoal: input.campaignGoal,
    formatGuide: input.formatGuide,
    productInfo: input.productInfo,
    assetContent,
    wordCountRange: input.wordCountRange || "150-250",
    styleInstruction: buildStyleInstruction(input.styleTags ?? [])
  };
  const generatedBody = await chain.invoke({
    ...basePromptInput,
    wordCountRange: platform === "XIAOHONGSHU" ? deriveBodyWordCountRange(input.wordCountRange) : (input.wordCountRange || "150-250")
  });
  let generatedContent = generatedBody;

  if (platform === "XIAOHONGSHU") {
    const titleChain = xiaohongshuTitlePrompt.pipe(model).pipe(new StringOutputParser());
    const generatedTitle = await titleChain.invoke({
      formatGuide: input.formatGuide,
      productInfo: input.productInfo,
      assetContent,
      campaignGoal: input.campaignGoal,
      styleInstruction: buildStyleInstruction(input.styleTags ?? [])
    });
    generatedContent = combineXiaohongshuContent(generatedTitle, generatedBody);
  }

  return {
    generatedContent,
    relevantAssets
  };
}
