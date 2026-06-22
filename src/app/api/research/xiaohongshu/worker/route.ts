import { NextResponse } from "next/server";
import { z } from "zod";

import {
  checkMediaCrawlerHealth,
  getMediaCrawlerConfig,
  saveMediaCrawlerConfig,
  startMediaCrawlerWorker
} from "@/lib/research/media-crawler";

export const dynamic = "force-dynamic";

const configSchema = z.object({
  path: z.string().optional(),
  baseUrl: z.string().optional(),
  startCommand: z.string().optional(),
  action: z.enum(["save", "start"]).optional()
});

export async function GET() {
  const [config, status] = await Promise.all([getMediaCrawlerConfig(), checkMediaCrawlerHealth()]);

  return NextResponse.json({
    config,
    status
  });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = configSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid worker payload" }, { status: 400 });
  }

  const config = await saveMediaCrawlerConfig(parsed.data);

  if (parsed.data.action === "start") {
    const status = await startMediaCrawlerWorker();
    return NextResponse.json({ config, status });
  }

  const status = await checkMediaCrawlerHealth();
  return NextResponse.json({ config, status });
}
