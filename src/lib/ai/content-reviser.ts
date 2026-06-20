import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { createChatModel } from "@/lib/ai/model-config";

const revisePrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是 WeChat Moments AI 的朋友圈文案润色助手。你只输出修改后的朋友圈正文。"
  ],
  [
    "human",
    "原文案：\n{content}\n\n修改意见：\n{revisionInstruction}\n\n请在保留核心卖点和朋友圈自然语气的基础上重新润色。不要解释修改过程。"
  ]
]);

export async function reviseMomentContent(input: {
  content: string;
  revisionInstruction: string;
}) {
  const model = await createChatModel({ temperature: 0.65 });
  const chain = revisePrompt.pipe(model).pipe(new StringOutputParser());

  return chain.invoke(input);
}
