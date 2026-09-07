import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import { existsSync, createWriteStream } from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes per chunk (each chunk is only 4MB, takes 1-3s)

const ALLOWED_VIDEO_EXTS = new Set([".mp4", ".webm", ".mkv", ".mov", ".avi"]);

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

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

    // Path traversal safe validation
    const rawBasename = path.basename(fileName);
    const ext = path.extname(rawBasename).toLowerCase();
    if (!ALLOWED_VIDEO_EXTS.has(ext)) {
      return NextResponse.json(
        { error: `Invalid video format (${ext}). Allowed: mp4, webm, mkv, mov, avi` },
        { status: 400 }
      );
    }

    // Temporary upload directory for chunks
    const tempDir = path.join(process.cwd(), "public", "uploads", "temp");
    if (!existsSync(tempDir)) {
      await fs.mkdir(tempDir, { recursive: true });
    }

    const cleanUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, "");
    const tempFilePath = path.join(tempDir, `${cleanUploadId}.tmp`);

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
