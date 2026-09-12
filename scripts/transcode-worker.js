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
  ["actual_height", "INTEGER"], ["video_codec", "TEXT"], ["audio_codec", "TEXT"], ["quality_warning", "TEXT"],
  ["input_path", "TEXT"],
  ["output_dir_name", "TEXT"],
  ["master_url", "TEXT"],
  ["attempts", "INTEGER NOT NULL DEFAULT 0"],
  ["source_quality", "INTEGER NOT NULL DEFAULT 0"],
]) {
  if (!jobColumns.includes(name)) db.exec(`ALTER TABLE transcode_jobs ADD COLUMN ${name} ${definition}`);
}

const threads = Math.min(2, Math.max(1, Math.floor(Number(process.env.TRANSCODE_THREADS) || 1)));
const { processMedia } = require('./transcode-engine.cjs');
const once = process.argv.includes('--once');
// One worker owns the queue, including local app fallback processes.
const lockPath = path.join(root,'data','transcode-worker.lock');
try {
  try {
    const owner=Number(fs.readFileSync(lockPath,'utf8'));
    try { process.kill(owner,0); process.exit(0); } catch(error) { if(error.code !== 'ESRCH') throw error; }
    fs.unlinkSync(lockPath);
  } catch(error) { if(error.code !== 'ENOENT') throw error; }
  fs.writeFileSync(lockPath,String(process.pid),{flag:'wx'});
} catch(error) { if(error.code === 'EEXIST') process.exit(0); throw error; }
process.on('exit',()=>{ try { if(fs.readFileSync(lockPath,'utf8')===String(process.pid)) fs.unlinkSync(lockPath); } catch {} });

let stopping = false;
let activeProcess = null;
let activeJobId = null;
function assertActive() {
  const row=db.prepare("SELECT status FROM transcode_jobs WHERE id=?").get(activeJobId);
  if(!row || row.status!=="processing") throw new Error("Job cancelled");
}

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
    const proc = spawn("nice", ["-n", "10", "ffmpeg", '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore','ignore','pipe'] });
    let errorTail='';
    proc.stderr.on('data',chunk=>{errorTail=(errorTail+chunk.toString()).slice(-2000);});
    activeProcess = proc;
    const cancelTimer=setInterval(()=>{try{assertActive();}catch{proc.kill('SIGTERM');}},200);
    proc.on("close", (code) => {
      clearInterval(cancelTimer);
      activeProcess = null;
      code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}: ${errorTail.trim()}`));
    });
    proc.on("error", (error) => {
      clearInterval(cancelTimer);
      activeProcess = null;
      reject(error);
    });
  });
}

async function processJob(job) {
  const { input, output } = safeJobPaths(job);
  const masterUrl = job.master_url || `/uploads/hls/${job.output_dir_name}/master.m3u8`;
  const completed = await processMedia({input,output,threads,sourceQuality:job.source_quality || 0,
    inspect: info => {
      db.prepare('UPDATE transcode_jobs SET actual_height=?,video_codec=?,audio_codec=?,quality_warning=? WHERE id=?').run(info.height,info.videoCodec,info.audioCodec,info.warning,job.id);
      if(info.warning)log('warn','Source quality corrected',{jobId:job.id,...info});
    },
    run: args => { if(stopping) throw new Error('Worker stopped'); assertActive(); return runFfmpeg(args); },
    progress: text => updateJob(job.id,{progress_text:text}),
    publish: () => {
      assertActive();
      if(job.server_id) db.prepare("UPDATE servers SET server_name=?,server_type='direct',stream_url=? WHERE id=?")
        .run('360p / 480p',masterUrl,job.server_id);
    },
  });
  // Bunny integration is retained but explicitly disabled unless re-enabled in settings.
  const bunny = db.prepare("SELECT value FROM site_settings WHERE key='bunny_playback_enabled'").get();
  if (bunny?.value === '1' && process.env.BUNNY_STORAGE_ENABLED === '1') {
    const {uploadHlsDirectory}=await import('./bunny-storage.mjs');
    await uploadHlsDirectory(output,job.output_dir_name);
  }
  assertActive();
  updateJob(job.id, { status: "complete", progress_text: `Done! ${completed.join(", ")} ready.` });
  log("info", "Job completed", { jobId: job.id, serverId: job.server_id });
}

async function main() {
  db.prepare("UPDATE transcode_jobs SET status='failed',progress_text='Retry limit reached; inspect error before manual repair',updated_at=datetime('now') WHERE status IN ('processing','pending') AND attempts>=3").run();
  // A processing row means the previous worker exited before finishing it.
  db.prepare(`UPDATE transcode_jobs SET status='pending', progress_text='Recovered after worker restart',
    updated_at=datetime('now') WHERE status='processing' AND attempts < 3`).run();
  db.prepare("UPDATE transcode_jobs SET status='cancelled' WHERE status='cancelling'").run();
  log("info", "Worker started", { threads });
  while (!stopping) {
    const job = claimNext();
    if (!job) {
      if (once) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    try {
      activeJobId=job.id;
      await processJob(job);
    } catch (error) {
      const state=db.prepare('SELECT status FROM transcode_jobs WHERE id=?').get(job.id);
      if(!state || ['cancelling','cancelled'].includes(state.status)) {
        updateJob(job.id,{status:'cancelled',progress_text:'Cancelled before media removal'});
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      const retry = stopping || job.attempts < 3;
      if (stopping) db.prepare("UPDATE transcode_jobs SET attempts=MAX(0,attempts-1) WHERE id=?").run(job.id);
      updateJob(job.id, {
        status: retry ? "pending" : "failed",
        progress_text: stopping ? "Paused for worker restart" : retry ? `Retry queued (${job.attempts}/3)` : "Transcoding failed",
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
