import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import { validateSavedMedia } from "@/lib/upload";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes per chunk (each chunk is only 4MB, takes 1-3s)

const ALLOWED_VIDEO_EXTS = new Set([".mp4", ".webm", ".mkv", ".mov", ".avi", ".ts"]);

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }
  const limited = rateLimit(request, "video-chunks", 3000, 60 * 60 * 1000, String(auth.admin?.id || ""));
  if (limited) return limited;

  try {
    const formData = await request.formData();
    const chunk = formData.get("chunk") as File | null;
    const uploadId = (formData.get("uploadId") as string) || "";
    const chunkIndex = parseInt((formData.get("chunkIndex") as string) || "0", 10);
    const totalChunks = parseInt((formData.get("totalChunks") as string) || "1", 10);
    const fileName = (formData.get("fileName") as string) || "video.mp4";

    if (!chunk || !uploadId) {
      return NextResponse.json({ error: "Missing chunk or uploadId" }, { status: 400 });
    }
    if (!(chunk instanceof File) || !/^[a-zA-Z0-9_-]{1,128}$/.test(uploadId) ||
        !Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || chunkIndex < 0 || chunkIndex >= totalChunks ||
        totalChunks < 1 || totalChunks > 2560 || chunk.size === 0 || chunk.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Invalid upload chunk" }, { status: 400 });
    }

    // Path traversal safe validation
    const rawBasename = path.basename(fileName);
    const ext = path.extname(rawBasename).toLowerCase();
    if (!ALLOWED_VIDEO_EXTS.has(ext)) {
      return NextResponse.json(
        { error: `Invalid video format (${ext}). Allowed: mp4, webm, mkv, mov, avi, ts` },
        { status: 400 }
      );
    }

    // Temporary upload directory for chunks
    const tempDir = path.join(process.cwd(), "data", "upload-temp", String(auth.admin!.id));
    if (!existsSync(tempDir)) {
      await fs.mkdir(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `${uploadId}.tmp`);
    const currentSize = await fs.stat(tempFilePath).then((stat) => stat.size).catch(() => 0);
    if (currentSize + chunk.size > 10 * 1024 ** 3) {
      return NextResponse.json({ error: "Video exceeds the 10 GB upload limit." }, { status: 413 });
    }

    // Append chunk buffer to temp file
    const chunkBytes = await chunk.arrayBuffer();
    await fs.appendFile(tempFilePath, Buffer.from(chunkBytes));

    // Check if this is the final chunk
    const isCompleted = chunkIndex === totalChunks - 1;

    if (isCompleted) {
      // Ensure target videos directory exists
      const videosDir = path.join(process.cwd(), "public", "uploads", "videos");
      if (!existsSync(videosDir)) {
        await fs.mkdir(videosDir, { recursive: true });
      }

      // Generate unique final filename
      const randomHash = crypto.randomBytes(8).toString("hex");
      const sanitizedName = rawBasename.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
      const finalFileName = `${Date.now()}-${randomHash}-${sanitizedName}${ext}`;
      const finalFilePath = path.join(videosDir, finalFileName);

      // Move completed temp file to final location
      await fs.rename(tempFilePath, finalFilePath);

      try { await validateSavedMedia(finalFilePath, true); }
      catch (error) { await fs.unlink(finalFilePath).catch(() => {}); throw error; }

      const stat = await fs.stat(finalFilePath);
      const videoUrl = `/uploads/videos/${finalFileName}`;

      return NextResponse.json({
        success: true,
        completed: true,
        videoUrl,
        fileName: rawBasename,
        fileSize: stat.size,
      });
    }

    return NextResponse.json({
      success: true,
      completed: false,
      chunkIndex,
      totalChunks,
    });
  } catch (err: any) {
    console.error("[Upload Chunk Error]:", err);
    return NextResponse.json({ error: err.message || "Chunk upload failed" }, { status: 500 });
  }
}
