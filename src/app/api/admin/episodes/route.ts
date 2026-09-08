import { getEpisodesByAnime, getEpisodesBySeason, createEpisode, deleteEpisode, createServer, createDownload } from "@/lib/db";
import { saveUploadedFile } from "@/lib/upload";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const maxDuration = 1800; // 30 minutes for slow mobile uploads

export async function GET(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const anime_id = parseInt(searchParams.get("anime_id") || "0");
  const season_id = parseInt(searchParams.get("season_id") || "0");
  
  let episodes: any[] = [];
  if (season_id) episodes = getEpisodesBySeason(season_id);
  else if (anime_id) episodes = getEpisodesByAnime(anime_id);
  
  return NextResponse.json(episodes);
}

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const anime_id = parseInt(formData.get("anime_id") as string);
    const season_id = parseInt(formData.get("season_id") as string);
    const episode_number = parseInt(formData.get("episode_number") as string);
    const title = formData.get("title") as string;
    const duration = (formData.get("duration") as string) || "";
    
    let thumbnail = "";
    const thumbFile = formData.get("thumbnail") as File | null;
    if (thumbFile && thumbFile.size > 0) {
      thumbnail = await saveUploadedFile(thumbFile);
    }
    
    // Create the episode
    const epId = createEpisode({ anime_id, season_id, episode_number, title, duration, thumbnail });

    // Check if a direct anime video file or pre-uploaded video_url was provided
    const videoFile = formData.get("video") as File | null;
    const uploadedVideoUrl = formData.get("video_url") as string | null;

    if ((videoFile && videoFile.size > 0) || (uploadedVideoUrl && uploadedVideoUrl.trim())) {
      let videoUrl = uploadedVideoUrl ? uploadedVideoUrl.trim() : "";
      if (!videoUrl && videoFile && videoFile.size > 0) {
        videoUrl = await saveUploadedFile(videoFile, "videos");
      }

      const path = await import("path");
      const absoluteVideoPath = path.join(process.cwd(), "public", videoUrl);
      const serverName = (formData.get("server_name") as string) || "Multi-Quality HD (2K / 1080p / 720p / 360p)";
      const serverId = createServer({
        episode_id: epId,
        server_name: serverName,
        server_type: "direct",
        stream_url: videoUrl,
        server_order: 0,
      });

      // Keep the original download available after the server switches to HLS.
      createDownload({ episode_id: epId, quality: "Original", download_url: videoUrl });

      // Background multi-quality HLS transcoding — only if enabled
      const { startHlsTranscoding } = await import("@/lib/transcoder");
      const { getSiteSettings: getSettings } = await import("@/lib/db");
      const siteConf = getSettings();
      if (siteConf.auto_transcode_enabled !== "0") {
        const outputDirName = `ep_${epId}_${Date.now()}`;
        startHlsTranscoding({
          inputPath: absoluteVideoPath,
          outputDirName,
          serverId,
        }).catch((err) => {
          console.error("[Episodes] Error during background HLS transcoding:", err);
        });
      } else {
        console.log("[Episodes] Auto-transcoding is OFF — skipping HLS conversion for server", serverId);
      }
    } else {
      // Check if external stream_url was provided
      const streamUrl = formData.get("stream_url") as string | null;
      if (streamUrl && streamUrl.trim()) {
        let cleanUrl = streamUrl.trim();
        if (cleanUrl.includes('<iframe') || cleanUrl.includes('src=')) {
          const match = cleanUrl.match(/src=["']([^"']+)["']/i);
          if (match && match[1]) {
            cleanUrl = match[1];
          }
        }
        const serverName = (formData.get("server_name") as string) || "Server 1";
        const serverType = (formData.get("server_type") as string) || "embed";
        createServer({
          episode_id: epId,
          server_name: serverName,
          server_type: serverType,
          stream_url: cleanUrl,
          server_order: 0,
        });
      }
    }

    return NextResponse.json({ success: true, id: epId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") || "0");
  if (id) {
    const { cleanupEpisodeFiles } = await import("@/lib/fileCleanup");
    cleanupEpisodeFiles(id);
    deleteEpisode(id);
  }
  return NextResponse.json({ success: true });
}
