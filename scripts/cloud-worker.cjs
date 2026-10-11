// AWS background worker (run with PM2 next to the website):
//  - runs AWS MediaConvert transcode jobs (Settings → Transcoding engine = AWS)
//  - copies finished VPS transcodes to S3 when "Sync to S3" is ON
//  - `--migrate` uploads existing local HLS folders and videos once, then exits
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const root = process.cwd();
require('@next/env').loadEnvConfig(root);
const aws = require('./cloud/aws.cjs');
const mediaConvert = require('./cloud/mediaconvert.cjs');

const db = new Database(path.join(root, 'data', 'anime.db'));
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
require('./cluster/schema.cjs').initializeCluster(db);
aws.initializeCloud(db);

const hlsRoot = path.join(root, 'public', 'uploads', 'hls');
const videoRoot = path.join(root, 'public', 'uploads', 'videos');
const migrate = process.argv.includes('--migrate');
const deleteAfterMigrate = process.argv.includes('--delete-local');
let stopping = false;

const log = (level, message, details = {}) =>
  console.log(JSON.stringify({ time: new Date().toISOString(), level, service: 'cloud-worker', message, ...details }));
const setting = (key) => db.prepare('SELECT value FROM site_settings WHERE key=?').get(key)?.value;
const update = (id, values) => db.prepare(`UPDATE transcode_jobs SET status=COALESCE(@status,status),
  progress_text=COALESCE(@progress_text,progress_text), error=COALESCE(@error,error), updated_at=datetime('now') WHERE id=@id`)
  .run({ id, status: null, progress_text: null, error: null, ...values });

function probe(url) {
  return new Promise((resolve, reject) => execFile('ffprobe', ['-v', 'error', '-protocol_whitelist', 'https,tls,tcp',
    '-format_whitelist', 'mov,matroska,webm,avi,mpegts', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height', '-of', 'json', url], { timeout: 60000, maxBuffer: 1024 * 1024 }, (error, out) => {
    if (error) return reject(new Error('Could not read the uploaded video from S3'));
    try { const s = JSON.parse(out).streams?.[0]; s?.height ? resolve(s) : reject(new Error('No video stream')); } catch (e) { reject(e); }
  }));
}

function videoUrlFor(job) {
  return job.input_path ? '/uploads/videos/' + path.basename(job.input_path) : null;
}

// Source must be in S3 before MediaConvert can read it.
async function ensureSourceInS3(job) {
  if (job.source_key && await aws.headObject(job.source_key)) return job.source_key;
  const local = job.input_path && fs.existsSync(job.input_path) ? job.input_path : null;
  if (!local) throw new Error('Source video is missing locally and in S3');
  update(job.id, { progress_text: 'Uploading source to S3...' });
  const key = 'videos/' + path.basename(local);
  const size = await aws.uploadFile(local, key);
  aws.registerObject(db, videoUrlFor(job), key, size);
  db.prepare('UPDATE transcode_jobs SET source_key=? WHERE id=?').run(key, job.id);
  return key;
}

async function startMediaConvert(job) {
  const claimed = db.prepare("UPDATE transcode_jobs SET status='processing',attempts=attempts+1,progress_text='Preparing AWS transcoding...',error='' WHERE id=? AND status='pending'").run(job.id);
  if (claimed.changes !== 1) return;
  try {
    const sourceKey = await ensureSourceInS3(job);
    const source = await probe(await aws.signedUrl(sourceKey, 3600, { download: 'probe' }));
    db.prepare('UPDATE transcode_jobs SET actual_height=? WHERE id=?').run(source.height, job.id);
    const created = await mediaConvert.createJob({ sourceKey, outputPrefix: `hls/${job.output_dir_name}/`, source });
    db.prepare('UPDATE transcode_jobs SET external_job_id=? WHERE id=?').run(created.id, job.id);
    const state = db.prepare('SELECT status FROM transcode_jobs WHERE id=?').get(job.id);
    if (!state || state.status !== 'processing') { await mediaConvert.cancelJob(created.id).catch(() => {}); return; }
    update(job.id, { progress_text: `AWS MediaConvert queued: ${created.renditions.join(', ')} + Original` });
    log('info', 'MediaConvert job created', { jobId: job.id, awsJob: created.id });
  } catch (error) {
    if (db.prepare('SELECT status FROM transcode_jobs WHERE id=?').get(job.id)?.status !== 'processing') return;
    const retry = job.attempts + 1 < 3;
    update(job.id, { status: retry ? 'pending' : 'failed', progress_text: retry ? 'AWS retry queued' : 'AWS transcoding failed',
      error: String(error.message || error).slice(0, 500) });
    log('error', 'MediaConvert start failed', { jobId: job.id, error: String(error.message || error) });
  }
}

async function publishMediaConvert(job) {
  const prefix = `hls/${job.output_dir_name}/`, folder = `/uploads/hls/${job.output_dir_name}/`;
  const ready = [];
  for (const r of ['360p', '480p', '720p', '1080p']) {
    try {
      const text = await aws.getText(`${prefix}master_${r}.m3u8`);
      if (text.startsWith('#EXTM3U') && text.includes('#EXT-X-ENDLIST')) ready.push(r);
    } catch {}
  }
  if (!ready.includes('360p')) throw new Error('AWS output is missing the 360p playlist');
  const original = await aws.headObject(`${prefix}original.mp4`);
  const published = db.transaction(() => {
    if (db.prepare('SELECT status FROM transcode_jobs WHERE id=?').get(job.id)?.status !== 'processing') return false;
    aws.registerObject(db, folder, prefix, 0, 'mediaconvert');
    aws.registerObject(db, folder + 'master.m3u8', prefix + 'master.m3u8', 0, 'mediaconvert');
    for (const r of ready) aws.registerObject(db, `${folder}${r}.m3u8`, `${prefix}master_${r}.m3u8`, 0, 'mediaconvert');
    if (original) aws.registerObject(db, folder + 'original.mp4', prefix + 'original.mp4', original.ContentLength || 0);
    if (job.server_id) db.prepare("UPDATE servers SET server_name=?,server_type='direct',stream_url=? WHERE id=?")
      .run('360p / 480p', job.master_url || folder + 'master.m3u8', job.server_id);
    db.prepare('UPDATE transcode_jobs SET cloud_synced=1 WHERE id=?').run(job.id);
    update(job.id, { status: 'complete', progress_text: `Done on AWS! ${ready.join(', ')}${original ? ', Original' : ''} ready.` });
    return true;
  })();
  if (!published) return;
  // The source stays in S3 for downloads; a local copy is only kept when asked to.
  if (setting('cloud_delete_local') === '1' && setting('cluster_enabled') !== '1' && job.input_path && fs.existsSync(job.input_path)) {
    fs.rmSync(job.input_path, { force: true });
  }
  log('info', 'MediaConvert job published', { jobId: job.id, ready });
}

async function pollMediaConvert() {
  if (!aws.config().mediaConvertReady) return;
  const pending = db.prepare(`SELECT * FROM transcode_jobs WHERE engine='mediaconvert' AND status='pending' AND attempts<3
    AND output_dir_name IS NOT NULL ORDER BY id LIMIT 3`).all();
  for (const job of pending) if (!stopping) await startMediaConvert(job);
  const running = db.prepare(`SELECT * FROM transcode_jobs WHERE engine='mediaconvert' AND status='processing'
    AND external_job_id IS NOT NULL`).all();
  for (const job of running) {
    if (stopping) break;
    try {
      const remote = await mediaConvert.getJob(job.external_job_id);
      if (remote.status === 'COMPLETE') await publishMediaConvert(job);
      else if (remote.status === 'ERROR' || remote.status === 'CANCELED') {
        update(job.id, { status: 'failed', progress_text: 'AWS transcoding failed', error: remote.error.slice(0, 500) || remote.status });
      } else update(job.id, { progress_text: `AWS MediaConvert: ${remote.status === 'SUBMITTED' ? 'waiting' : `${remote.percent}%`}` });
    } catch (error) {
      log('error', 'MediaConvert poll failed', { jobId: job.id, error: String(error.message || error) });
    }
  }
}

function completePlaylist(file) {
  try { const text = fs.readFileSync(file, 'utf8'); return text.startsWith('#EXTM3U') && text.includes('#EXT-X-ENDLIST'); } catch { return false; }
}

async function syncFolder(dirName) {
  if (!/^[a-zA-Z0-9_-]+$/.test(dirName)) return false;
  const local = path.join(hlsRoot, dirName);
  if (!fs.existsSync(path.join(local, 'master.m3u8'))) return false;
  const prefix = `hls/${dirName}/`, folder = `/uploads/hls/${dirName}/`;
  const sizes = await aws.uploadDirectory(local, prefix, (done, total) => log('info', 'Uploading HLS', { dirName, done, total }));
  db.transaction(() => {
    aws.registerObject(db, folder, prefix, 0, 'file');
    for (const name of Object.keys(sizes)) {
      if ((name.endsWith('.m3u8') && (name === 'master.m3u8' || completePlaylist(path.join(local, name)))) || name === 'original.mp4') {
        aws.registerObject(db, folder + name, prefix + name, sizes[name]);
      }
    }
  })();
  return true;
}

async function syncVideo(file) {
  const name = path.basename(file);
  if (!fs.existsSync(file) || aws.cloudObject(db, '/uploads/videos/' + name)) return;
  const size = await aws.uploadFile(file, 'videos/' + name);
  aws.registerObject(db, '/uploads/videos/' + name, 'videos/' + name, size);
}

function removeLocal(job) {
  if (setting('cluster_enabled') === '1') return; // Media nodes replicate from local files.
  const dir = path.join(hlsRoot, job.output_dir_name);
  if (dir.startsWith(hlsRoot + path.sep)) fs.rmSync(dir, { recursive: true, force: true });
  if (job.input_path && path.resolve(job.input_path).startsWith(videoRoot + path.sep)) fs.rmSync(job.input_path, { force: true });
}

async function syncCompletedVpsJobs() {
  if (setting('cloud_sync_enabled') !== '1' || !aws.config().storageReady) return;
  const jobs = db.prepare(`SELECT * FROM transcode_jobs WHERE status='complete' AND COALESCE(engine,'vps')='vps'
    AND cloud_synced=0 AND output_dir_name IS NOT NULL ORDER BY id LIMIT 2`).all();
  for (const job of jobs) {
    if (stopping) break;
    try {
      update(job.id, { progress_text: 'Uploading to S3...' });
      await syncFolder(job.output_dir_name);
      if (job.input_path) await syncVideo(job.input_path);
      db.prepare('UPDATE transcode_jobs SET cloud_synced=1 WHERE id=?').run(job.id);
      update(job.id, { progress_text: 'Done! Stored on AWS S3.' });
      if (setting('cloud_delete_local') === '1') removeLocal(job);
      log('info', 'Synced to S3', { jobId: job.id });
    } catch (error) {
      // Keep it unsynced; local playback keeps working and the next pass retries.
      update(job.id, { progress_text: 'Done! (S3 upload will retry)', error: String(error.message || error).slice(0, 500) });
      log('error', 'S3 sync failed', { jobId: job.id, error: String(error.message || error) });
    }
  }
}

async function migrateAll() {
  if (!aws.config().storageReady) throw new Error('Set AWS_REGION and AWS_S3_BUCKET first');
  const folders = fs.existsSync(hlsRoot) ? fs.readdirSync(hlsRoot).filter((n) => fs.statSync(path.join(hlsRoot, n)).isDirectory()) : [];
  for (const dirName of folders) {
    if (stopping) return;
    if (aws.cloudObject(db, `/uploads/hls/${dirName}/master.m3u8`)) continue;
    try { if (await syncFolder(dirName)) log('info', 'Migrated HLS folder', { dirName }); }
    catch (error) { log('error', 'Folder migration failed', { dirName, error: String(error.message || error) }); }
  }
  const videos = fs.existsSync(videoRoot) ? fs.readdirSync(videoRoot).filter((n) => /\.(mp4|webm|mkv|mov|avi|ts)$/i.test(n)) : [];
  for (const name of videos) {
    if (stopping) return;
    try { await syncVideo(path.join(videoRoot, name)); log('info', 'Migrated video', { name }); }
    catch (error) { log('error', 'Video migration failed', { name, error: String(error.message || error) }); }
  }
  db.prepare(`UPDATE transcode_jobs SET cloud_synced=1 WHERE status='complete' AND output_dir_name IN
    (SELECT substr(path,14,length(path)-25) FROM cloud_objects WHERE path LIKE '/uploads/hls/%/master.m3u8')`).run();
  if (deleteAfterMigrate) {
    for (const job of db.prepare("SELECT * FROM transcode_jobs WHERE status='complete' AND cloud_synced=1").all()) removeLocal(job);
  }
  log('info', 'Migration finished', { folders: folders.length, videos: videos.length });
}

async function main() {
  if (migrate) { await migrateAll(); db.close(); return; }
  log('info', 'Worker started', { storage: aws.config().storageReady, mediaConvert: aws.config().mediaConvertReady });
  while (!stopping) {
    try { await pollMediaConvert(); await syncCompletedVpsJobs(); }
    catch (error) { log('error', 'Loop failed', { error: String(error.message || error) }); }
    for (let i = 0; i < 15 && !stopping; i++) await new Promise((r) => setTimeout(r, 1000));
  }
  db.close();
  log('info', 'Worker stopped');
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
main().catch((error) => { log('error', 'Worker crashed', { error: String(error.message || error) }); process.exitCode = 1; });
