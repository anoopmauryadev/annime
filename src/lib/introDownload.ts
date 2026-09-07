import { createHash, randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const run = promisify(execFile);
type Media = {
  format: { duration: string };
  streams: { codec_type: string; width?: number; height?: number; avg_frame_rate?: string; tags?: { language?: string; title?: string } }[];
};

async function probe(file: string): Promise<Media> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { timeout: 30000 });
  return JSON.parse(stdout);
}

async function joinIntro(source: string, intro: string, output: string) {
  const [movie, ident] = await Promise.all([probe(source), probe(intro)]);
  const video = movie.streams.find(s => s.codec_type === "video");
  const seconds = Number(ident.format.duration);
  const duration = Number(movie.format.duration);
  if (!video?.width || !video.height || !Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(duration) || duration <= 0) {
    throw new Error("Video duration or dimensions could not be read.");
  }
  const width = Math.ceil(video.width / 2) * 2;
  const height = Math.ceil(video.height / 2) * 2;
  const rate = video.avg_frame_rate || "30/1";
  const [n, d] = rate.split("/").map(Number);
  const fps = n > 0 && d > 0 ? rate : "30";
  const normalize = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p,setpts=PTS-STARTPTS`;
  const filters = [`[0:v:0]${normalize}[iv]`, `[1:v:0]${normalize}[mv]`, "[iv][mv]concat=n=2:v=1:a=0[v]"];
  const audio = movie.streams.filter(s => s.codec_type === "audio");
  const count = Math.max(audio.length, 1);
  const maps = ["-map", "[v]"];
  for (let i = 0; i < count; i++) {
    const introAudio = ident.streams.some(s => s.codec_type === "audio") ? "[0:a:0]aresample=48000,aformat=channel_layouts=stereo" : "anullsrc=r=48000:cl=stereo";
    const movieAudio = audio[i] ? `[1:a:${i}]aresample=48000,aformat=channel_layouts=stereo` : "anullsrc=r=48000:cl=stereo";
    filters.push(`${introAudio},apad,atrim=duration=${seconds},asetpts=PTS-STARTPTS[ia${i}]`, `${movieAudio},apad,atrim=duration=${duration},asetpts=PTS-STARTPTS[ma${i}]`, `[ia${i}][ma${i}]concat=n=2:v=0:a=1[a${i}]`);
    maps.push("-map", `[a${i}]`, `-metadata:s:a:${i}`, `language=${audio[i]?.tags?.language || "und"}`);
    if (audio[i]?.tags?.title) maps.push(`-metadata:s:a:${i}`, `title=${audio[i].tags!.title}`);
  }
  const subtitles = movie.streams.some(s => s.codec_type === "subtitle");
  const args = ["-y", "-v", "error", "-nostdin", "-i", intro, "-i", source];
  // Move subtitle timestamps forward by the intro's duration too.
  if (subtitles) { args.push("-itsoffset", String(seconds), "-i", source); maps.push("-map", "2:s?", "-c:s", "mov_text"); }
  args.push("-filter_complex_threads", "1", "-filter_complex", filters.join(";"), ...maps, "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-t", String(seconds + duration), "-movflags", "+faststart", output);
  await run("ffmpeg", args, { maxBuffer: 1024 * 1024, timeout: 6 * 60 * 60 * 1000 });
  const result = await probe(output);
  if (Math.abs(Number(result.format.duration) - (seconds + duration)) > 1) throw new Error("Prepared video duration is incomplete.");
}

// One encode per Node process keeps the VPS responsive. Repeated requests share a job.
const state = globalThis as typeof globalThis & { introDownloadJobs?: Map<string, { status: "processing" | "failed"; error?: string; updated: number }> };
const jobs = state.introDownloadJobs ??= new Map();

export async function prepareIntroDownload(source: string, intro: string, start: boolean, cache = path.join(process.cwd(), "data", "intro-downloads")) {
  const [a, b] = await Promise.all([fs.stat(source), fs.stat(intro)]);
  const key = createHash("sha256").update(`v2:${source}:${a.size}:${a.mtimeMs}:${intro}:${b.size}:${b.mtimeMs}`).digest("hex");
  const output = path.join(cache, `${key}.mp4`);
  if (await fs.stat(output).then(s => s.size > 0).catch(() => false)) return { status: "ready", path: output };
  const existing = jobs.get(output);
  if (existing?.status === "processing" || (existing && !start)) return existing;
  if (!start) return { status: "pending" };
  if ([...jobs.values()].some(job => job.status === "processing")) return { status: "busy" };
  jobs.set(output, { status: "processing", updated: Date.now() });
  void (async () => {
    const partial = path.join(cache, `${key}-${randomUUID()}.partial.mp4`);
    try {
      await fs.mkdir(cache, { recursive: true });
      await joinIntro(source, intro, partial);
      await fs.rename(partial, output);
      jobs.delete(output);
    } catch (error) {
      console.error("[Download intro]", error instanceof Error ? error.message : error);
      jobs.set(output, { status: "failed", error: "Intro could not be added. Please try again or contact the admin to check FFmpeg and the intro file.", updated: Date.now() });
    } finally {
      await fs.rm(partial, { force: true });
      for (const [id, job] of jobs) if (job.status === "failed" && Date.now() - job.updated > 3600000) jobs.delete(id);
    }
  })();
  return { status: "processing" };
}
