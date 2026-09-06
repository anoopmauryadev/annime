import { saveUploadedFile } from "@/lib/upload";
import { createServer, createDownload } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { startHlsTranscoding } from "@/lib/transcoder";
import { NextResponse } from "next/server";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File | null;
    const episodeId = formData.get("episode_id") ? parseInt(formData.get("episode_id") as string) : null;
    const serverName = (formData.get("server_name") as string) || "Multi-Quality HD (2K / 1080p / 720p / 360p)";

    if (!videoFile || videoFile.size === 0) {
      return NextResponse.json({ error: "No video file uploaded" }, { status: 400 });
    }

    // Save into public/uploads/videos/ with strict extension checking
    const videoUrl = await saveUploadedFile(videoFile, "videos");
    const absoluteVideoPath = path.join(process.cwd(), "public", videoUrl);

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
        const ext = path.extname(videoFile.name || "").replace(".", "").toUpperCase() || "MP4";
        const fileSizeMB = (videoFile.size / (1024 * 1024)).toFixed(1);
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
      fileName: videoFile.name,
      fileSize: videoFile.size,
      transcoding: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to upload video" }, { status: 500 });
  }
}
