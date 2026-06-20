import { Document } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

import { createChatModel, createEmbeddingModel, getAiModelConfig } from "@/lib/ai/model-config";

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

const contentPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是一个专业的私域朋友圈文案写手。你要根据内容形式、产品资料、已选图文素材和图片特征分析，输出自然、有转化力、不过度营销的朋友圈正文。"
  ],
  [
    "human",
    "内容形式：\n{formatGuide}\n\n产品信息：\n{productInfo}\n\n已选素材与图片特征：\n{assetContent}\n\n文案目标：{campaignGoal}\n\n要求：\n1. 文案适合朋友圈手动发布，语气自然可信。\n2. 必须结合产品卖点和图片特征，不要凭空编造未提供的信息。\n3. 如果图片分析里有外观、材质、场景、质感等特征，要把精华自然融入文案。\n4. 可适度使用 emoji，但不要堆砌。\n5. 包含一个温和的行动引导。\n6. 只输出正文，不解释创作过程。"
  ]
]);

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

export async function retrieveRelevantAssets(input: {
  campaignGoal: string;
  assets: ProductAssetForGeneration[];
  limit?: number;
}) {
  const limit = input.limit ?? 8;

  if (input.assets.length <= limit) {
    return input.assets;
  }

  const config = await getAiModelConfig();

  if (!config.embedding.model) {
    return keywordRetrieve({
      campaignGoal: input.campaignGoal,
      assets: input.assets,
      limit
    });
  }

  const vectorStore = await MemoryVectorStore.fromDocuments(
    input.assets.map(assetToDocument),
    await createEmbeddingModel()
  );
  const results = await vectorStore.similaritySearchWithScore(input.campaignGoal, limit);

  return results.map(([document, score]) => {
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
      score
    };
  });
}

export async function generateMomentContent(input: {
  campaignGoal: string;
  formatGuide: string;
  productInfo: string;
  assets: ProductAssetForGeneration[];
}) {
  const relevantAssets = await retrieveRelevantAssets({
    campaignGoal: input.campaignGoal,
    assets: input.assets,
    limit: 8
  });
  const assetContent = relevantAssets
    .map((item, index) => {
      return [
        `素材${index + 1}`,
        `标题：${item.title || "未命名"}`,
        `类型：${String(item.type).toUpperCase() === "IMAGE" ? "图片" : "文本"}`,
        `标签：${item.tags.join(", ") || "无"}`,
        `图片：${item.imageUrl || "无"}`,
        `图片分析：${item.imageAnalysis || "无"}`,
        `内容：${item.content || "无"}`
      ].join("\n");
    })
    .join("\n\n---\n\n");
  const model = await createChatModel({ temperature: 0.75 });
  const chain = contentPrompt.pipe(model).pipe(new StringOutputParser());
  const generatedContent = await chain.invoke({
    campaignGoal: input.campaignGoal,
    formatGuide: input.formatGuide,
    productInfo: input.productInfo,
    assetContent
  });

  return {
    generatedContent,
    relevantAssets
  };
}
