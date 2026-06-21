import { NextResponse } from "next/server";
import { z } from "zod";

import { AI_CAPABILITIES, getRuntimeEndpoint } from "@/lib/ai/model-config";

export const dynamic = "force-dynamic";

const modelListSchema = z.object({
  capability: z.enum(AI_CAPABILITIES).default("llm"),
  endpoint: z
    .object({
      baseUrl: z.string().optional(),
      apiKey: z.string().optional()
    })
    .optional()
});

function normalizeBaseUrl(baseUrl: string) {
  return (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function parseModelIds(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const maybeData = (payload as { data?: unknown }).data;
  const source = Array.isArray(maybeData) ? maybeData : Array.isArray(payload) ? payload : [];

  return source
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
        return (item as { id: string }).id;
      }

      return "";
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = modelListSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid model list payload" }, { status: 400 });
    }

    const endpoint = await getRuntimeEndpoint(parsed.data.capability, parsed.data.endpoint);

    if (!endpoint.apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "请先填写或保存 API Key，再获取可用模型。",
          elapsedMs: Date.now() - startedAt
        },
        { status: 400 }
      );
    }

    const response = await fetch(`${normalizeBaseUrl(endpoint.baseUrl)}/models`, {
      headers: {
        Authorization: `Bearer ${endpoint.apiKey}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            typeof payload === "object" && payload && "error" in payload
              ? JSON.stringify((payload as { error: unknown }).error)
              : "获取模型列表失败",
          elapsedMs: Date.now() - startedAt
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      models: parseModelIds(payload),
      elapsedMs: Date.now() - startedAt
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "获取模型列表失败",
        elapsedMs: Date.now() - startedAt
      },
      { status: 500 }
    );
  }
}
