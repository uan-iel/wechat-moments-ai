import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { createChatModel } from "@/lib/ai/model-config";
import { getPlatformStyleMemory } from "@/lib/ai/moments-style-memory";
import { normalizePlatform } from "@/lib/platforms";

const revisePrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是 WeChat Moments AI 的社交平台文案润色助手。",
      "你只输出修改后的正文。",
      "必须保留原文的核心产品信息，但要严格按目标平台的表达习惯重写。",
      "如果是小红书，重点优化开头抓点、分段节奏、种草感、关键词自然融入和互动收尾。",
      "如果是朋友圈，重点优化自然分享感、熟人语气和顺滑节奏。"
    ].join("\n")
  ],
  [
    "human",
    "目标平台：{platformLabel}\n平台要求：\n{platformInstruction}\n\n平台底层文风记忆：\n{platformStyleMemory}\n\n原文案：\n{content}\n\n修改意见：\n{revisionInstruction}\n\n请在保留核心卖点的基础上重新润色。不要解释修改过程。"
  ]
]);

const xiaohongshuReviseTitlePrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "你是一个小红书笔记标题润色助手。",
      "你只输出 1 行标题，不要输出正文、解释、序号、标签或引号。",
      "标题要更有点击欲和场景代入感，但仍然真实克制。"
    ].join("\n")
  ],
  [
    "human",
    "小红书底层文风记忆：\n{platformStyleMemory}\n\n原文案：\n{content}\n\n修改意见：\n{revisionInstruction}\n\n请重写一个更适合小红书的标题，控制在 12 到 24 个汉字之间，只输出标题。"
  ]
]);

function splitXiaohongshuContent(content: string) {
  const [firstBlock, ...restBlocks] = content.trim().split(/\n\s*\n/);
  const title = firstBlock?.trim() || "";
  const body = restBlocks.join("\n\n").trim();

  if (!body) {
    const lines = content.trim().split("\n").map((line) => line.trim()).filter(Boolean);
    return {
      title: lines[0] || "",
      body: lines.slice(1).join("\n").trim()
    };
  }

  return { title, body };
}

function combineXiaohongshuContent(title: string, body: string) {
  const cleanTitle = title.trim().replace(/^["'“”‘’#\s]+|["'“”‘’#\s]+$/g, "");
  const cleanBody = body.trim();

  return cleanTitle ? `${cleanTitle}\n\n${cleanBody}` : cleanBody;
}

export async function reviseMomentContent(input: {
  platform?: "MOMENTS" | "XIAOHONGSHU";
  content: string;
  revisionInstruction: string;
  platformStyleMemory?: string | null;
}) {
  const model = await createChatModel({ temperature: 0.65 });
  const platform = normalizePlatform(input.platform);
  const platformStyleMemory = input.platformStyleMemory?.trim() || getPlatformStyleMemory(platform);
  const chain = revisePrompt.pipe(model).pipe(new StringOutputParser());
  const revisedBody = await chain.invoke({
    ...input,
    platformLabel: platform === "XIAOHONGSHU" ? "小红书" : "朋友圈",
    platformStyleMemory,
    platformInstruction:
      platform === "XIAOHONGSHU"
        ? [
            "建议保留“短标题感开头 + 2 到 4 段正文”的节奏。",
            "自然埋入和产品相关的搜索型关键词，不要生硬堆砌。",
            "更强调体验感、场景感、种草感，收尾可带轻互动。"
          ].join("\n")
        : [
            "整体像真实生活分享，不要标题党。",
            "重视语气自然、节奏顺畅、像熟人之间会发的内容。"
          ].join("\n")
  });

  if (platform !== "XIAOHONGSHU") {
    return revisedBody;
  }

  const { title: existingTitle } = splitXiaohongshuContent(input.content);
  const titleChain = xiaohongshuReviseTitlePrompt.pipe(model).pipe(new StringOutputParser());
  const revisedTitle = await titleChain.invoke({
    platformStyleMemory,
    content: input.content,
    revisionInstruction: input.revisionInstruction,
    existingTitle
  });

  return combineXiaohongshuContent(revisedTitle, revisedBody);
}
