import { Document } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

import { createChatModel, createEmbeddingModel, getAiModelConfig } from "@/lib/ai/model-config";

export type KnowledgeForGeneration = {
  id: string;
  type: string;
  title?: string | null;
  content: string;
  imageUrl?: string | null;
  tags: string[];
};

export type RetrievedKnowledge = KnowledgeForGeneration & {
  score?: number;
};

const contentPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是一个专业的私域营销文案写手，擅长为朋友圈生成自然、有转化力、不过度营销的内容。"
  ],
  [
    "human",
    "请严格遵循以下风格：\n{styleDescription}\n\n基于以下产品信息：\n{knowledgeContent}\n\n为“{campaignGoal}”撰写一条吸引人的朋友圈文案。\n要求：\n1. 文案适合朋友圈发布，口吻自然可信。\n2. 明确传达卖点，但不要像硬广。\n3. 可适度使用 emoji，但必须符合给定风格。\n4. 包含一个温和的行动引导。\n5. 输出正文即可，不要解释创作过程。"
  ]
]);

function knowledgeToDocument(item: KnowledgeForGeneration) {
  return new Document({
    pageContent: `素材标题：${item.title || "未命名"}\n素材类型：${item.type}\n标签：${item.tags.join(", ") || "无"}\n图片：${item.imageUrl || "无"}\n内容：${item.content}`,
    metadata: {
      id: item.id,
      type: item.type,
      tags: item.tags
    }
  });
}

function tokenize(value: string) {
  const normalized = value.toLowerCase();
  const asciiTokens = normalized.match(/[a-z0-9]+/g) ?? [];
  const cjkTokens = normalized.match(/[\u4e00-\u9fa5]+/g) ?? [];
  const cjkChars = cjkTokens.join("").split("");

  return [...asciiTokens, ...cjkTokens, ...cjkChars]
    .map((token) => token.trim())
    .filter((token) => token.length >= 1);
}

function scoreKnowledge(campaignGoal: string, item: KnowledgeForGeneration) {
  const goalTokens = tokenize(campaignGoal);
  const itemText = [item.title, item.content, item.tags.join(" "), item.imageUrl].filter(Boolean).join(" ");
  const itemLower = itemText.toLowerCase();
  const tokenScore = goalTokens.reduce((score, token) => {
    return score + (itemLower.includes(token) ? 2 : 0);
  }, 0);
  const directScore = itemLower.includes(campaignGoal.toLowerCase()) ? 5 : 0;

  return tokenScore + directScore;
}

function keywordRetrieve(input: {
  campaignGoal: string;
  knowledgeItems: KnowledgeForGeneration[];
  limit: number;
}) {
  return input.knowledgeItems
    .map((item, index) => ({
      ...item,
      score: scoreKnowledge(input.campaignGoal, item) - index / 1000
    }))
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, input.limit);
}

export async function retrieveRelevantKnowledge(input: {
  campaignGoal: string;
  knowledgeItems: KnowledgeForGeneration[];
  limit?: number;
}) {
  const limit = input.limit ?? 3;

  if (input.knowledgeItems.length <= limit) {
    return input.knowledgeItems;
  }

  const config = await getAiModelConfig();

  if (!config.embeddingModel) {
    return keywordRetrieve({
      campaignGoal: input.campaignGoal,
      knowledgeItems: input.knowledgeItems,
      limit
    });
  }

  const vectorStore = await MemoryVectorStore.fromDocuments(
    input.knowledgeItems.map(knowledgeToDocument),
    await createEmbeddingModel()
  );
  const results = await vectorStore.similaritySearchWithScore(input.campaignGoal, limit);

  return results.map(([document, score]) => {
    const source = input.knowledgeItems.find((item) => item.id === document.metadata.id);

    return {
      ...(source ?? {
        id: String(document.metadata.id),
        type: String(document.metadata.type),
        title: null,
        tags: Array.isArray(document.metadata.tags) ? document.metadata.tags : [],
        imageUrl: null,
        content: document.pageContent
      }),
      score
    };
  });
}

export async function generateMomentContent(input: {
  campaignGoal: string;
  styleDescription: string;
  knowledgeItems: KnowledgeForGeneration[];
}) {
  const relevantKnowledge = await retrieveRelevantKnowledge({
    campaignGoal: input.campaignGoal,
    knowledgeItems: input.knowledgeItems,
    limit: 3
  });
  const knowledgeContent = relevantKnowledge
    .map((item, index) => {
      return `素材${index + 1}\n标题：${item.title || "未命名"}\n类型：${item.type}\n标签：${item.tags.join(", ") || "无"}\n图片：${item.imageUrl || "无"}\n内容：${item.content}`;
    })
    .join("\n\n---\n\n");
  const model = await createChatModel({ temperature: 0.75 });
  const chain = contentPrompt.pipe(model).pipe(new StringOutputParser());
  const generatedContent = await chain.invoke({
    campaignGoal: input.campaignGoal,
    styleDescription: input.styleDescription,
    knowledgeContent
  });

  return {
    generatedContent,
    relevantKnowledge
  };
}
