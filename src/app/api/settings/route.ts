import { NextResponse } from "next/server";
import { z } from "zod";

import { AI_CAPABILITIES, saveAiModelConfig, getAiModelSettingsForClient } from "@/lib/ai/model-config";

export const dynamic = "force-dynamic";

const endpointSchema = z.object({
  baseUrl: z.string().default(""),
  model: z.string().default(""),
  apiKey: z.string().optional()
});

const settingsSchema = z.object({
  aiModelConfig: z
    .object(
      Object.fromEntries(AI_CAPABILITIES.map((capability) => [capability, endpointSchema.optional()]))
    )
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
