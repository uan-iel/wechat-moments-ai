import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createChatModel,
  createEmbeddingModel,
  getAiModelSettingsForClient
} from "@/lib/ai/model-config";

export const dynamic = "force-dynamic";

const testAiSchema = z.object({
  capability: z.enum(["llm", "embedding", "vision", "image", "audio"]).default("llm")
});

const capabilityLabels = {
  llm: "LLM",
  embedding: "Embedding",
  vision: "视觉理解",
  image: "图片生成",
  audio: "语音/音频"
} as const;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = testAiSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid model test payload"
        },
        { status: 400 }
      );
    }

    const settings = await getAiModelSettingsForClient();
    const capability = parsed.data.capability;

    if (!settings.hasApiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "请先配置模型 API Key。"
        },
        { status: 400 }
      );
    }

    if (capability === "llm") {
      const model = await createChatModel({
        temperature: 0,
        model: settings.llmModel
      });
      const response = await model.invoke("请只回复 OK，用于测试模型连通性。");

      return NextResponse.json({
        ok: true,
        capability,
        provider: settings.provider,
        model: settings.llmModel,
        response: typeof response.content === "string" ? response.content : "OK"
      });
    }

    if (capability === "embedding") {
      const embeddings = await createEmbeddingModel();
      const vector = await embeddings.embedQuery("朋友圈智能营销素材检索测试");

      return NextResponse.json({
        ok: true,
        capability,
        provider: settings.provider,
        model: settings.embeddingModel,
        response: `向量维度 ${vector.length}`
      });
    }

    const modelByCapability = {
      vision: settings.visionModel,
      image: settings.imageModel,
      audio: settings.audioModel
    } as const;
    const model = modelByCapability[capability];

    if (!model) {
      return NextResponse.json(
        {
          ok: false,
          capability,
          error: `请先配置${capabilityLabels[capability]}模型。`
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      capability,
      provider: settings.provider,
      model,
      response: `${capabilityLabels[capability]}配置已就绪。此项未发起真实素材调用。`
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "模型连接测试失败"
      },
      { status: 500 }
    );
  }
}
