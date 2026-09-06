import { getActiveBroadcast, getSiteSettings } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const broadcast = getActiveBroadcast();
    const settings = getSiteSettings();

    return NextResponse.json({
      broadcast,
      telegram: {
        enabled: settings.telegram_enabled === "1",
        url: settings.telegram_url || "https://t.me/",
        text: settings.telegram_text || "Join Official Telegram for latest Hindi & Multi-Audio releases!",
        btn_text: settings.telegram_btn_text || "Join",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
