import { spawn } from "child_process";
import path from "path";
import { createTranscodeJob } from "@/lib/db";

interface TranscodeOptions { inputPath: string; outputDirName: string; serverId?: number; sourceQuality?: number }
export async function startHlsTranscoding({inputPath,outputDirName,serverId,sourceQuality=0}: TranscodeOptions): Promise<string> {
  const master = `/uploads/hls/${outputDirName}/master.m3u8`;
  createTranscodeJob({server_id:serverId || null,status:"pending",progress_text:"Queued: 360p, 480p, Original Quality",
    input_path:inputPath,output_dir_name:outputDirName,master_url:master,source_quality:sourceQuality});
  if(process.env.TRANSCODE_WORKER_MODE !== "external") {
    const worker=spawn(process.execPath,[path.join(process.cwd(),"scripts/transcode-worker.js"),"--once"],{stdio:"ignore",detached:true});
    worker.on("error",error=>console.error("Worker launch failed",error));
    worker.unref();
  }
  return master;
}
