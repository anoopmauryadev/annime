import { saveUploadedFile, validateSavedMedia } from "@/lib/upload";
import { createServer, createDownload } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { startHlsTranscoding } from "@/lib/transcoder";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";
export const maxDuration = 1800; // 30 minutes for slow mobile uploads

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File | null;
    const uploadedVideoUrl = formData.get("video_url") as string | null;
    const episodeId = formData.get("episode_id") ? parseInt(formData.get("episode_id") as string) : null;
    const serverName = (formData.get("server_name") as string) || "Multi-Quality HD (2K / 1080p / 720p / 360p)";

    const hasVideo = (videoFile && videoFile.size > 0) || (uploadedVideoUrl && uploadedVideoUrl.trim());
    if (!hasVideo) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    let videoUrl = uploadedVideoUrl ? uploadedVideoUrl.trim() : "";
    if (!videoUrl && videoFile && videoFile.size > 0) {
      videoUrl = await saveUploadedFile(videoFile, "videos");
    }

    if (!videoUrl.startsWith("/uploads/videos/") || !/\.(mp4|webm|mkv|mov|avi)$/i.test(videoUrl)) {
      return NextResponse.json({ error: "Select a locally uploaded video" }, { status: 400 });
    }
    const root = await fs.realpath(path.join(process.cwd(), "public", "uploads", "videos"));
    const absoluteVideoPath = await fs.realpath(path.join(process.cwd(), "public", videoUrl));
    if (!absoluteVideoPath.startsWith(root + path.sep) || !(await fs.stat(absoluteVideoPath)).isFile()) {
      return NextResponse.json({ error: "Invalid uploaded video path" }, { status: 400 });
    }
    if (uploadedVideoUrl) await validateSavedMedia(absoluteVideoPath, true);

    let serverId = null;
    if (episodeId) {
      serverId = createServer({
        episode_id: episodeId,
        server_name: serverName,
        server_type: "direct",
        stream_url: videoUrl,
        server_order: 0,
      });

      // Also register real video download for VIP members
      try {
        const ext = path.extname(videoUrl || "").replace(".", "").toUpperCase() || "MP4";
        const fs = await import("fs/promises");
        let fileSizeMB = "100.0";
        try {
          const stat = await fs.stat(absoluteVideoPath);
          fileSizeMB = (stat.size / (1024 * 1024)).toFixed(1);
        } catch {}

        createDownload({
          episode_id: episodeId,
          quality: `1080p Full HD (${ext})`,
          download_url: videoUrl,
          file_size: `${fileSizeMB} MB`,
        });
      } catch (dlErr) {
        console.error("[Upload] Failed to create download record:", dlErr);
      }

      // Generate a unique folder name for HLS segments based on timestamp and clean name
      const outputDirName = `ep_${episodeId}_${Date.now()}`;
      
      // Trigger background HLS multi-bitrate transcoding (non-blocking)
      startHlsTranscoding({
        inputPath: absoluteVideoPath,
        outputDirName,
        serverId,
      }).catch((err) => {
        console.error("[Upload] Error during background HLS transcoding:", err);
      });
    }

    return NextResponse.json({
      success: true,
      url: videoUrl,
      serverId,
      fileName: videoFile?.name || path.basename(videoUrl),
      fileSize: videoFile?.size || 0,
      transcoding: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to upload video" }, { status: 500 });
  }
}
