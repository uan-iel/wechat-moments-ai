import { NextResponse } from "next/server";
import { z } from "zod";

import { getAiModelSettingsForClient, saveAiModelConfig } from "@/lib/ai/model-config";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  aiModelConfig: z
    .object({
      provider: z.enum(["openai", "deepseek", "custom"]),
      baseUrl: z.string().default(""),
      llmModel: z.string().min(1),
      embeddingModel: z.string().default(""),
      visionModel: z.string().default(""),
      imageModel: z.string().default(""),
      audioModel: z.string().default(""),
      apiKey: z.string().optional()
    })
    .optional()
});

export async function GET() {
  const aiModelSettings = await getAiModelSettingsForClient();

  return NextResponse.json({
    settings: {
      aiModelSettings
    }
  });
}

export async function PATCH(request: Request) {
  const json = await request.json();
  const parsed = settingsSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
  }

  const aiModelSettings = parsed.data.aiModelConfig
    ? await saveAiModelConfig(parsed.data.aiModelConfig)
    : await getAiModelSettingsForClient();

  return NextResponse.json({
    settings: {
      aiModelSettings
    }
  });
}
