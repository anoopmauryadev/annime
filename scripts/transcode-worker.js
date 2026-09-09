const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = process.cwd();
require("@next/env").loadEnvConfig(root);
const db = new Database(path.join(root, "data", "anime.db"));
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

const jobColumns = db.prepare("PRAGMA table_info(transcode_jobs)").all().map((column) => column.name);
for (const [name, definition] of [
  ["input_path", "TEXT"],
  ["output_dir_name", "TEXT"],
  ["master_url", "TEXT"],
  ["attempts", "INTEGER NOT NULL DEFAULT 0"],
]) {
  if (!jobColumns.includes(name)) db.exec(`ALTER TABLE transcode_jobs ADD COLUMN ${name} ${definition}`);
}

const threads = Math.max(1, Number(process.env.TRANSCODE_THREADS || 2));
const profiles = [
  { name: "360p", width: 640, height: 360, bitrate: "800k", audioBitrate: "64k" },
  { name: "720p", width: 1280, height: 720, bitrate: "2400k", audioBitrate: "128k" },
  { name: "1080p", width: 1920, height: 1080, bitrate: "4800k", audioBitrate: "128k" },
];

let stopping = false;
let activeProcess = null;

function log(level, message, details = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, service: "transcode-worker", message, ...details }));
}

function updateJob(id, values) {
  db.prepare(`UPDATE transcode_jobs SET
    status=COALESCE(@status,status), progress_text=COALESCE(@progress_text,progress_text),
    error=COALESCE(@error,error), updated_at=datetime('now') WHERE id=@id`)
    .run({ id, status: null, progress_text: null, error: null, ...values });
}

const claimNext = db.transaction(() => {
  const job = db.prepare(`SELECT * FROM transcode_jobs
    WHERE status='pending' AND attempts < 3 AND input_path IS NOT NULL AND output_dir_name IS NOT NULL
    ORDER BY id LIMIT 1`).get();
  if (!job) return null;
  const result = db.prepare(`UPDATE transcode_jobs SET status='processing', attempts=attempts+1,
    progress_text='Starting transcoding...', error='', updated_at=datetime('now')
    WHERE id=? AND status='pending'`).run(job.id);
  return result.changes === 1 ? { ...job, attempts: job.attempts + 1 } : null;
});

function safeJobPaths(job) {
  const videoRoot = fs.realpathSync(path.join(root, "public", "uploads", "videos"));
  const input = fs.realpathSync(job.input_path);
  if (!input.startsWith(videoRoot + path.sep) || !fs.statSync(input).isFile()) throw new Error("Invalid input path");
  if (!/^[a-zA-Z0-9_-]+$/.test(job.output_dir_name)) throw new Error("Invalid output directory");
  const hlsRoot = path.join(root, "public", "uploads", "hls");
  const output = path.join(hlsRoot, job.output_dir_name);
  if (!output.startsWith(hlsRoot + path.sep)) throw new Error("Invalid output path");
  fs.mkdirSync(output, { recursive: true });
  return { input, output };
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: "ignore" });
    activeProcess = proc;
    proc.on("close", (code) => {
      activeProcess = null;
      code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`));
    });
    proc.on("error", (error) => {
      activeProcess = null;
      reject(error);
    });
  });
}

async function processJob(job) {
  const { input, output } = safeJobPaths(job);
  const completed = [];
  for (const profile of profiles) {
    if (stopping) throw new Error("Worker stopped");
    updateJob(job.id, { progress_text: `Transcoding ${profile.name} (${completed.length + 1}/${profiles.length})...` });
    await runFfmpeg([
      "-y", "-i", input,
      "-vf", `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2`,
      "-c:v", "libx264", "-b:v", profile.bitrate, "-maxrate", profile.bitrate,
      "-bufsize", `${parseInt(profile.bitrate) * 1.5}k`, "-preset", "veryfast", "-threads", String(threads),
      "-c:a", "aac", "-b:a", profile.audioBitrate, "-hls_time", "4", "-hls_playlist_type", "vod",
      "-hls_segment_filename", path.join(output, `${profile.name}_%03d.ts`),
      path.join(output, `${profile.name}.m3u8`),
    ]);
    completed.push(profile.name);
  }

  const masterUrl = job.master_url || `/uploads/hls/${job.output_dir_name}/master.m3u8`;
  let master = "#EXTM3U\n#EXT-X-VERSION:3\n";
  for (const profile of profiles) {
    master += `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(profile.bitrate) * 1000},RESOLUTION=${profile.width}x${profile.height},NAME="${profile.name}"\n${profile.name}.m3u8\n`;
  }
  fs.writeFileSync(path.join(output, "master.m3u8"), master, "utf8");
  if (process.env.BUNNY_STORAGE_ENABLED === "1") {
    updateJob(job.id, { progress_text: "Uploading HLS files to Bunny Storage..." });
    const { uploadHlsDirectory } = await import("./bunny-storage.mjs");
    const uploaded = await uploadHlsDirectory(output, job.output_dir_name);
    log("info", "Uploaded HLS directory to Bunny Storage", { jobId: job.id, files: uploaded });
  }
  if (job.server_id) {
    db.prepare(`UPDATE servers SET server_name=?, server_type='direct', stream_url=? WHERE id=?`)
      .run("Multi-Quality HD (Auto / 1080p / 720p / 360p)", masterUrl, job.server_id);
  }
  updateJob(job.id, { status: "complete", progress_text: `Done! ${completed.join(", ")} ready.` });
  log("info", "Job completed", { jobId: job.id, serverId: job.server_id });
}

async function main() {
  // A processing row means the previous worker exited before finishing it.
  db.prepare(`UPDATE transcode_jobs SET status='pending', progress_text='Recovered after worker restart',
    updated_at=datetime('now') WHERE status='processing' AND attempts < 3`).run();
  log("info", "Worker started", { threads });
  while (!stopping) {
    const job = claimNext();
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    try {
      await processJob(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retry = !stopping && job.attempts < 3;
      updateJob(job.id, {
        status: retry ? "pending" : "failed",
        progress_text: retry ? `Retry queued (${job.attempts}/3)` : "Transcoding failed",
        error: message.slice(0, 500),
      });
      log("error", "Job failed", { jobId: job.id, error: message, retry });
    }
  }
  db.close();
  log("info", "Worker stopped");
}

function stop() {
  stopping = true;
  if (activeProcess) activeProcess.kill("SIGTERM");
}

process.on("SIGTERM", stop);
process.on("SIGINT", stop);
main().catch((error) => {
  log("error", "Worker crashed", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
