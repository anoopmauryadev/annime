import { spawn } from "child_process";
import path from "path";
import { createTranscodeJob } from "@/lib/db";
import { cloudSettings } from "@/lib/cloudMedia";

interface TranscodeOptions { inputPath: string; outputDirName: string; serverId?: number; sourceQuality?: number; sourceKey?: string | null }
export async function startHlsTranscoding({inputPath,outputDirName,serverId,sourceQuality=0,sourceKey=null}: TranscodeOptions): Promise<string> {
  const master = `/uploads/hls/${outputDirName}/master.m3u8`;
  // Settings → Transcoding engine: VPS FFmpeg, or AWS MediaConvert (handled by scripts/cloud-worker.cjs).
  const engine = cloudSettings().engine;
  createTranscodeJob({server_id:serverId || null,status:"pending",
    progress_text:engine === "mediaconvert" ? "Queued on AWS MediaConvert" : "Queued: 360p, 480p, Original Quality",
    input_path:inputPath,output_dir_name:outputDirName,master_url:master,source_quality:sourceQuality,engine,source_key:sourceKey});
  if(engine === "vps" && process.env.TRANSCODE_WORKER_MODE !== "external") {
    const worker=spawn(process.execPath,[path.join(process.cwd(),"scripts/transcode-worker.js"),"--once"],{stdio:"ignore",detached:true});
    worker.on("error",error=>console.error("Worker launch failed",error));
    worker.unref();
  }
  return master;
}
