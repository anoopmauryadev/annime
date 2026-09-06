import { getAllBroadcasts, createBroadcast } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const broadcasts = getAllBroadcasts();
  return NextResponse.json(broadcasts);
}

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, message, theme, icon, btn_text, btn_url, is_active, dismissible } = body;

    if (!title || !message) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
    }

    const id = createBroadcast({
      title,
      message,
      theme: theme || "orange",
      icon: icon || "sparkles",
      btn_text: btn_text || "",
      btn_url: btn_url || "",
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : 1,
      dismissible: dismissible !== undefined ? (dismissible ? 1 : 0) : 1,
    });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create broadcast" }, { status: 500 });
  }
}
