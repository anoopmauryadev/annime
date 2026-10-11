import { requireAdminAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { cloudSettings, multipart, signedMediaUrl } from "@/lib/cloudMedia";
import { NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const run = promisify(execFile);
const PART_SIZE = 16 * 1024 * 1024;
const MAX_SIZE = 10 * 1024 ** 3;
const EXTS = new Set([".mp4", ".webm", ".mkv", ".mov", ".avi", ".ts"]);
const KEY = /^videos\/(\d{13}-[a-f0-9]{16}-[a-zA-Z0-9_-]{0,30}\.(mp4|webm|mkv|mov|avi|ts))$/;

// GET tells the admin upload form where videos go (Settings → Upload destination).
export async function GET(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ target: cloudSettings().uploadTarget, partSize: PART_SIZE });
}

// Browser → S3 multipart upload. Bytes never pass through the VPS; this route only signs requests.
export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = rateLimit(request, "s3-upload", 3000, 60 * 60 * 1000, String(auth.admin?.id || ""));
  if (limited) return limited;
  if (cloudSettings().uploadTarget !== "s3") return NextResponse.json({ error: "S3 upload is turned off" }, { status: 409 });

  try {
    const body = await request.json();
    const action = body?.action;
    if (action === "create") {
      const name = path.basename(String(body.fileName || ""));
      const ext = path.extname(name).toLowerCase();
      const size = Number(body.size);
      if (!EXTS.has(ext)) return NextResponse.json({ error: `Invalid video format (${ext}). Allowed: mp4, webm, mkv, mov, avi, ts` }, { status: 400 });
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_SIZE) return NextResponse.json({ error: "Video exceeds the 10 GB upload limit." }, { status: 413 });
      const safe = name.slice(0, -ext.length).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
      const key = `videos/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safe}${ext}`;
      const uploadId = await multipart.create(key, multipart.contentType(key));
      return NextResponse.json({ key, uploadId, partSize: PART_SIZE, totalParts: Math.ceil(size / PART_SIZE) });
    }

    const key = String(body?.key || "");
    const uploadId = String(body?.uploadId || "");
    if (!KEY.test(key) || !uploadId || uploadId.length > 1024) return NextResponse.json({ error: "Invalid upload" }, { status: 400 });

    if (action === "sign") {
      const parts = Array.isArray(body.partNumbers) ? body.partNumbers : [];
      if (!parts.length || parts.length > 20 || !parts.every((n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 10000)) {
        return NextResponse.json({ error: "Invalid part numbers" }, { status: 400 });
      }
      return NextResponse.json({ urls: await multipart.signParts(key, uploadId, parts) });
    }

    if (action === "complete") {
      const parts = Array.isArray(body.parts) ? body.parts : [];
      if (!parts.length || parts.length > 10000 || !parts.every((p: { partNumber?: unknown; etag?: unknown }) =>
        Number.isInteger(p?.partNumber) && typeof p?.etag === "string" && p.etag.length < 200)) {
        return NextResponse.json({ error: "Invalid part list" }, { status: 400 });
      }
      await multipart.complete(key, uploadId, [...parts].sort((a, b) => a.partNumber - b.partNumber));
      const head = await multipart.head(key);
      const size = Number(head?.ContentLength || 0);
      if (!head || size <= 0 || size > MAX_SIZE) {
        await multipart.remove(key).catch(() => {});
        return NextResponse.json({ error: "Upload is empty or too large" }, { status: 400 });
      }
      // Same check as VPS uploads: the file must contain a real video stream.
      try {
        const url = await signedMediaUrl(key, { download: "probe" });
        // Whitelists stop a playlist disguised as a video from making ffprobe fetch other URLs.
        const { stdout } = await run("ffprobe", ["-v", "error", "-protocol_whitelist", "https,tls,tcp", "-format_whitelist", "mov,matroska,webm,avi,mpegts", "-select_streams", "v:0", "-show_entries", "stream=codec_type", "-of", "json", url], { timeout: 60000 });
        if (!JSON.parse(stdout).streams?.some((s: { codec_type?: string }) => s.codec_type === "video")) throw new Error("no video");
      } catch {
        await multipart.remove(key).catch(() => {});
        return NextResponse.json({ error: "Uploaded file is not a valid video" }, { status: 400 });
      }
      const videoUrl = `/uploads/videos/${KEY.exec(key)![1]}`;
      multipart.register(videoUrl, key, size);
      return NextResponse.json({ success: true, completed: true, videoUrl, fileSize: size });
    }

    if (action === "abort") {
      await multipart.abort(key, uploadId).catch(() => {});
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[S3 Upload]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "S3 upload failed" }, { status: 500 });
  }
}
