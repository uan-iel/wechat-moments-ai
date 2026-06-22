import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createChatModel,
  createEmbeddingModelFromEndpoint,
  createEmbeddingModel,
  getRuntimeEndpoint,
  getAiModelSettingsForClient
} from "@/lib/ai/model-config";

export const dynamic = "force-dynamic";

const testAiSchema = z.object({
  capability: z.enum(["llm", "embedding", "vision", "image", "audio"]).default("llm"),
  endpoint: z
    .object({
      baseUrl: z.string().optional(),
      model: z.string().optional(),
      apiKey: z.string().optional()
    })
    .optional()
});

const capabilityLabels = {
  llm: "LLM",
  embedding: "Embedding",
  vision: "视觉理解",
  image: "图片生成",
  audio: "语音/音频"
} as const;

export async function POST(request: Request) {
  const startedAt = Date.now();

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

    const runtimeEndpoint = await getRuntimeEndpoint(capability, parsed.data.endpoint);
    const endpoint = parsed.data.endpoint
      ? {
          ...settings[capability],
          baseUrl: runtimeEndpoint.baseUrl,
          model: runtimeEndpoint.model,
          hasApiKey: Boolean(runtimeEndpoint.apiKey)
        }
      : settings[capability];

    if (!endpoint.hasApiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: `请先配置${capabilityLabels[capability]} API Key。`,
          elapsedMs: Date.now() - startedAt
        },
        { status: 400 }
      );
    }

    if (!endpoint.model) {
      return NextResponse.json(
        {
          ok: false,
          error: `请先配置${capabilityLabels[capability]}模型名称。`,
          elapsedMs: Date.now() - startedAt
        },
        { status: 400 }
      );
    }

    if (capability === "llm") {
      const model = await createChatModel({
        temperature: 0,
        model: endpoint.model,
        endpoint: parsed.data.endpoint
      });
      const response = await model.invoke("请只回复 OK，用于测试模型连通性。");

      return NextResponse.json({
        ok: true,
        capability,
        model: endpoint.model,
        response: typeof response.content === "string" ? response.content : "OK",
        elapsedMs: Date.now() - startedAt
      });
    }

    if (capability === "vision") {
      const model = await createChatModel({
        capability: "vision",
        temperature: 0,
        model: endpoint.model,
        endpoint: parsed.data.endpoint
      });
      const response = await model.invoke([
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请只回复 OK，用于测试图片理解模型连通性。"
            },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4n8AAAAASUVORK5CYII="
              }
            }
          ]
        }
      ]);

      return NextResponse.json({
        ok: true,
        capability,
        model: endpoint.model,
        response: typeof response.content === "string" ? response.content : "图片理解模型配置可用。",
        elapsedMs: Date.now() - startedAt
      });
    }

    if (capability === "embedding") {
      const embeddings = parsed.data.endpoint
        ? createEmbeddingModelFromEndpoint(runtimeEndpoint)
        : await createEmbeddingModel();
      const vector = await embeddings.embedQuery("朋友圈智能营销素材检索测试");

      return NextResponse.json({
        ok: true,
        capability,
        model: endpoint.model,
        response: `向量维度 ${vector.length}`,
        elapsedMs: Date.now() - startedAt
      });
    }

    return NextResponse.json({
      ok: true,
      capability,
      model: endpoint.model,
      response: `${capabilityLabels[capability]}配置已就绪。此项未发起真实素材调用。`,
      elapsedMs: Date.now() - startedAt
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "模型连接测试失败",
        elapsedMs: Date.now() - startedAt
      },
      { status: 500 }
    );
  }
}
