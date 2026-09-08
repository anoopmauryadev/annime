import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { updateServer, createTranscodeJob, updateTranscodeJob } from "@/lib/db";

interface TranscodeOptions {
  inputPath: string; // Absolute path to input video
  outputDirName: string; // e.g. "video_uuid"
  serverId?: number; // Optional DB server ID to update upon completion
}

// Keep transcoding off the request path and run only one heavy FFmpeg job at a
// time. This prevents a burst of uploads from starving the web server.
const transcodeQueue: Array<() => Promise<void>> = [];
let activeTranscodes = 0;
const maxConcurrentTranscodes = Math.max(1, Number(process.env.TRANSCODE_CONCURRENCY || 1));

function drainTranscodeQueue() {
  while (activeTranscodes < maxConcurrentTranscodes && transcodeQueue.length) {
    const job = transcodeQueue.shift()!;
    activeTranscodes += 1;
    void job().finally(() => {
      activeTranscodes -= 1;
      drainTranscodeQueue();
    });
  }
}

export function startHlsTranscoding({ inputPath, outputDirName, serverId }: TranscodeOptions): Promise<string> {
  return new Promise((resolve) => {
    const hlsBaseDir = path.join(process.cwd(), "public", "uploads", "hls", outputDirName);
    if (!fs.existsSync(hlsBaseDir)) {
      fs.mkdirSync(hlsBaseDir, { recursive: true });
    }

    const masterPlaylistPath = path.join(hlsBaseDir, "master.m3u8");
    const publicMasterUrl = `/uploads/hls/${outputDirName}/master.m3u8`;

    let jobId: number | null = null;
    try {
      jobId = createTranscodeJob({
        server_id: serverId || null,
        status: "pending",
        progress_text: "Queued",
        input_path: inputPath,
        output_dir_name: outputDirName,
        master_url: publicMasterUrl,
      });
    } catch (error) {
      console.error("[Transcoder] Could not persist queued job:", error);
    }

    // Production VPS runs a separate PM2 worker. It claims this persisted job,
    // so an app restart cannot silently lose the queue.
    if (process.env.TRANSCODE_WORKER_MODE === "external") {
      resolve(publicMasterUrl);
      return;
    }

    // Profiles for Multi-Quality Adaptive Streaming
    // 360p (Mobile/Data Saver), 720p (HD), 1080p (Full HD)
    // Note: 1440p removed to significantly speed up transcoding time
    const profiles = [
      { name: "360p", width: 640, height: 360, bitrate: "800k", audioBitrate: "64k" },
      { name: "720p", width: 1280, height: 720, bitrate: "2400k", audioBitrate: "128k" },
      { name: "1080p", width: 1920, height: 1080, bitrate: "4800k", audioBitrate: "128k" },
    ];

    // Queue the work so uploads return immediately and FFmpeg cannot saturate
    // all CPU cores while requests are being served.
    transcodeQueue.push(async () => {
      console.log(`[Transcoder] Starting multi-quality HLS transcoding for: ${inputPath}`);

      if (jobId) {
        updateTranscodeJob(jobId, { status: "processing", progress_text: "Starting transcoding..." });
      }

      const completedProfiles: string[] = [];

      for (const p of profiles) {
        const outSegment = path.join(hlsBaseDir, `${p.name}_%03d.ts`);
        const outM3u8 = path.join(hlsBaseDir, `${p.name}.m3u8`);

        // Update job status
        if (jobId) {
          try {
            updateTranscodeJob(jobId, {
              progress_text: `Transcoding ${p.name} (${completedProfiles.length + 1}/${profiles.length})...`,
            });
          } catch {}
        }

        const ffmpegArgs = [
          "-y",
          "-i", inputPath,
          "-vf", `scale=w=${p.width}:h=${p.height}:force_original_aspect_ratio=decrease,pad=${p.width}:${p.height}:(ow-iw)/2:(oh-ih)/2`,
          "-c:v", "libx264",
          "-b:v", p.bitrate,
          "-maxrate", p.bitrate,
          "-bufsize", `${parseInt(p.bitrate) * 1.5}k`,
          "-preset", "veryfast",
          "-threads", String(Math.max(1, Number(process.env.TRANSCODE_THREADS || 2))),
          "-c:a", "aac",
          "-b:a", p.audioBitrate,
          "-hls_time", "4",
          "-hls_playlist_type", "vod",
          "-hls_segment_filename", outSegment,
          outM3u8,
        ];

        try {
          await runFfmpeg(ffmpegArgs);
          completedProfiles.push(p.name);
          console.log(`[Transcoder] Finished profile ${p.name}`);
        } catch (err) {
          console.error(`[Transcoder] Warning: Failed to transcode profile ${p.name}:`, err);
        }
      }

      // Write master.m3u8 combining available variants
      let masterContent = "#EXTM3U\n#EXT-X-VERSION:3\n";
      for (const p of profiles) {
        const variantFile = path.join(hlsBaseDir, `${p.name}.m3u8`);
        if (fs.existsSync(variantFile)) {
          const bandwidth = parseInt(p.bitrate) * 1000;
          masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${p.width}x${p.height},NAME="${p.name}"\n${p.name}.m3u8\n`;
        }
      }

      fs.writeFileSync(masterPlaylistPath, masterContent, "utf8");
      console.log(`[Transcoder] Master playlist created at: ${masterPlaylistPath}`);

      // Update server record in SQLite if serverId is provided
      if (serverId) {
        try {
          updateServer(serverId, {
            server_name: "Multi-Quality HD (Auto / 2K / 1080p / 720p / 360p)",
            server_type: "direct",
            stream_url: publicMasterUrl,
          });
          console.log(`[Transcoder] Updated server ${serverId} with HLS master URL: ${publicMasterUrl}`);
        } catch (dbErr) {
          console.error("[Transcoder] Failed to update server stream URL in database:", dbErr);
        }
      }

      // Mark job as complete
      if (jobId) {
        try {
          updateTranscodeJob(jobId, {
            status: completedProfiles.length > 0 ? "complete" : "failed",
            progress_text: completedProfiles.length > 0
              ? `Done! ${completedProfiles.join(", ")} ready.`
              : "Transcoding failed for all profiles.",
          });
        } catch {}
      }
    });
    drainTranscodeQueue();

    // Resolve immediately with the public master URL
    resolve(publicMasterUrl);
  });
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: "ignore" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
    proc.on("error", (err) => reject(err));
  });
}
