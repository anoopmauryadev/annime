import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { getSiteSettings, setSiteSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const settings = getSiteSettings();
  return NextResponse.json({
    vip_store_url: settings.vip_store_url || "https://t.me/",
  });
}

export async function POST(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const storeUrl = (body.vip_store_url || "").trim();

    if (!storeUrl) {
      return NextResponse.json(
        { error: "Store URL cannot be empty." },
        { status: 400 }
      );
    }

    setSiteSetting("vip_store_url", storeUrl);

    return NextResponse.json({
      success: true,
      message: "VIP store link updated successfully.",
      vip_store_url: storeUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update VIP store link" },
      { status: 500 }
    );
  }
}
