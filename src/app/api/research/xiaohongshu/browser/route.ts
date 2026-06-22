import { NextResponse } from "next/server";

import { getLoginBrowserStatus, openLoginBrowser } from "@/lib/research/media-crawler";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getLoginBrowserStatus();

  return NextResponse.json({
    status
  });
}

export async function POST() {
  try {
    const status = await openLoginBrowser();

    return NextResponse.json({
      ok: true,
      status
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "打开登录浏览器失败"
      },
      { status: 500 }
    );
  }
}
