import { requireAdminAuth } from "@/lib/auth";
import { getSiteSettings, setSiteSettings } from "@/lib/db";
import { saveUploadedFile } from "@/lib/upload";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = getSiteSettings();
  return NextResponse.json({
    enabled: settings.video_intro_enabled !== "0",
    downloadEnabled: settings.video_intro_download_enabled === "1",
    url: settings.video_intro_url || "/brand/anime-zone-intro-4k.mp4",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const settings: Record<string, string> = {};
    if (form.has("enabled")) settings.video_intro_enabled = form.get("enabled") === "1" ? "1" : "0";
    if (form.has("downloadEnabled")) settings.video_intro_download_enabled = form.get("downloadEnabled") === "1" ? "1" : "0";
    if (file && file.size > 0) settings.video_intro_url = await saveUploadedFile(file, "brand");
    if (Object.keys(settings).length) setSiteSettings(settings);
    return NextResponse.json({ success: true, ...settings, settings: getSiteSettings() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 400 });
  }
}
