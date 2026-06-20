import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是 WeChat Moments AI，专注朋友圈营销文案。输出要贴近给定风格，合规、自然、有行动引导。"
  ],
  [
    "human",
    "营销目标：{goal}\n文案风格：{style}\n素材信息：{materials}\n请生成一条朋友圈初稿。"
  ]
]);

export async function generateMomentDraft(input: {
  goal: string;
  style: string;
  materials: string;
}) {
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    temperature: 0.7
  });

  const chain = prompt.pipe(model);
  const response = await chain.invoke(input);

  return response.content;
}
