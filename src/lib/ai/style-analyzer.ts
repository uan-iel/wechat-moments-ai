import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { createChatModel } from "@/lib/ai/model-config";

const styleAnalysisPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是 WeChat Moments AI 的风格学习引擎。你只输出可直接用于后续文案生成的风格描述。"
  ],
  [
    "human",
    "请分析以下朋友圈文案合集，提炼出作者的文案风格。从语气、常用词汇、句式结构、emoji使用习惯、发布节奏等维度进行总结。输出一段200字以内的风格描述。\n\n朋友圈文案合集：\n{momentsText}"
  ]
]);

export async function analyzeMomentStyle(momentsText: string) {
  const model = await createChatModel({ temperature: 0.2 });

  const chain = styleAnalysisPrompt.pipe(model).pipe(new StringOutputParser());

  return chain.invoke({
    momentsText
  });
}
