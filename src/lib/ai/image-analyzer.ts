import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { createChatModel } from "@/lib/ai/model-config";

export async function analyzeProductImage(input: {
  imageUrl: string;
  productName?: string | null;
  contentFormatName?: string | null;
  hint?: string | null;
}) {
  const model = await createChatModel({
    capability: "vision",
    temperature: 0.2
  });
  const response = await model.invoke([
    new SystemMessage(
      "你是一个私域营销图片分析助手。请从产品图片中提炼可用于朋友圈文案的视觉信息，只总结能从图片或上下文中合理判断的内容，不要编造。"
    ),
    new HumanMessage({
      content: [
        {
          type: "text",
          text: [
            `产品名称：${input.productName || "未提供"}`,
            `内容形式：${input.contentFormatName || "未提供"}`,
            `补充说明：${input.hint || "无"}`,
            "请分析这张产品图，从外观、颜色、材质/质感、使用场景、视觉情绪、适合强调的卖点几个维度输出 150 字以内的中文摘要。"
          ].join("\n")
        },
        {
          type: "image_url",
          image_url: {
            url: input.imageUrl
          }
        }
      ]
    })
  ]);

  return typeof response.content === "string"
    ? response.content.trim()
    : JSON.stringify(response.content);
}
