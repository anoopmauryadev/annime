import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = getSiteSettings();
    return NextResponse.json({
      vip_store_url: settings.vip_store_url || "https://t.me/",
    });
  } catch (err: any) {
    return NextResponse.json(
      { vip_store_url: "https://t.me/" },
      { status: 200 }
    );
  }
}
