// Shared AWS storage helpers for the Next.js app and the background workers.
// Public URLs stay /uploads/...; this module only maps them to S3 object keys
// and produces short-lived signed delivery URLs after the app has authorized a viewer.
const fs = require('fs');
const path = require('path');

const contentTypes = {
  '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mkv': 'video/x-matroska', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.vtt': 'text/vtt',
};
const contentType = (name) => contentTypes[path.extname(name).toLowerCase()] || 'application/octet-stream';

function config() {
  const env = process.env;
  const cdn = (env.CLOUDFRONT_DOMAIN || '').trim().replace(/\/$/, '');
  let privateKey = (env.CLOUDFRONT_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (!privateKey && env.CLOUDFRONT_PRIVATE_KEY_PATH) {
    try { privateKey = fs.readFileSync(env.CLOUDFRONT_PRIVATE_KEY_PATH, 'utf8'); } catch {}
  }
  const region = (env.AWS_REGION || '').trim(), bucket = (env.AWS_S3_BUCKET || '').trim();
  return {
    region, bucket, privateKey, keyPairId: (env.CLOUDFRONT_KEY_PAIR_ID || '').trim(),
    cdn: cdn && !/^https?:\/\//.test(cdn) ? `https://${cdn}` : cdn,
    mediaConvertRole: (env.MEDIACONVERT_ROLE_ARN || '').trim(),
    storageReady: !!(region && bucket),
    get cloudFrontReady() { return !!(this.storageReady && this.cdn && this.keyPairId && this.privateKey); },
    get mediaConvertReady() { return !!(this.storageReady && this.mediaConvertRole); },
  };
}

let client = null, clientRegion = '';
function s3() {
  const { region } = config();
  if (!client || clientRegion !== region) {
    const { S3Client } = require('@aws-sdk/client-s3');
    client = new S3Client({ region }); clientRegion = region;
  }
  return client;
}
function requireStorage() {
  const c = config();
  if (!c.storageReady) throw new Error('AWS S3 is not configured (AWS_REGION, AWS_S3_BUCKET)');
  return c;
}

function initializeCloud(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS cloud_objects (
    path TEXT PRIMARY KEY, object_key TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0,
    layout TEXT NOT NULL DEFAULT 'file', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='transcode_jobs'").get();
  if (!exists) return;
  const columns = db.prepare('PRAGMA table_info(transcode_jobs)').all().map((c) => c.name);
  for (const [name, definition] of [
    ['engine', "TEXT NOT NULL DEFAULT 'vps'"], ['source_key', 'TEXT'], ['external_job_id', 'TEXT'],
    ['cloud_synced', 'INTEGER NOT NULL DEFAULT 0'],
  ]) if (!columns.includes(name)) db.exec(`ALTER TABLE transcode_jobs ADD COLUMN ${name} ${definition}`);
}

// path is the public URL (/uploads/videos/x.mp4, /uploads/hls/dir/360p.m3u8, or a folder ending in /).
function registerObject(db, urlPath, objectKey, size = 0, layout = 'file') {
  db.prepare(`INSERT INTO cloud_objects(path,object_key,size,layout) VALUES(?,?,?,?)
    ON CONFLICT(path) DO UPDATE SET object_key=excluded.object_key,size=excluded.size,layout=excluded.layout`)
    .run(urlPath, objectKey, size, layout);
}
function cloudObject(db, urlPath) {
  try { return db.prepare('SELECT * FROM cloud_objects WHERE path=?').get(urlPath) || null; } catch { return null; }
}
// Segments are not registered one by one: they resolve through their folder row.
function cloudSegmentKey(db, urlPath) {
  const folder = cloudObject(db, urlPath.replace(/[^/]+$/, ''));
  if (!folder) return null;
  const name = urlPath.split('/').pop();
  return folder.object_key + (folder.layout === 'mediaconvert' && !name.startsWith('master_') ? `master_${name}` : name);
}

async function uploadFile(localPath, key, type = contentType(localPath)) {
  const { bucket } = requireStorage();
  const { Upload } = require('@aws-sdk/lib-storage');
  const upload = new Upload({ client: s3(), queueSize: 4, partSize: 16 * 1024 * 1024,
    params: { Bucket: bucket, Key: key, Body: fs.createReadStream(localPath), ContentType: type } });
  await upload.done();
  return fs.statSync(localPath).size;
}

// Uploads a finished HLS folder. Playlists go last so no published playlist points at missing segments.
async function uploadDirectory(localDir, prefix, onProgress = () => {}) {
  const names = fs.readdirSync(localDir).filter((n) => !n.startsWith('.') && fs.statSync(path.join(localDir, n)).isFile());
  const ordered = [...names.filter((n) => !n.endsWith('.m3u8')), ...names.filter((n) => n.endsWith('.m3u8') && n !== 'master.m3u8'),
    ...names.filter((n) => n === 'master.m3u8')];
  let done = 0, next = 0;
  const sizes = {};
  const work = async () => {
    while (next < ordered.length) {
      const name = ordered[next++];
      // Playlists must wait for every segment; keep their order strict.
      if (name.endsWith('.m3u8')) while (done < ordered.indexOf(name)) await new Promise((r) => setTimeout(r, 50));
      sizes[name] = await uploadFile(path.join(localDir, name), prefix + name);
      done++;
      if (done % 25 === 0 || done === ordered.length) onProgress(done, ordered.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, work));
  return sizes;
}

async function downloadFile(key, localPath) {
  const { bucket } = requireStorage();
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { pipeline } = require('stream/promises');
  const result = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  const temp = `${localPath}.download`;
  await pipeline(result.Body, fs.createWriteStream(temp));
  fs.renameSync(temp, localPath);
}

const textCache = new Map();
async function getText(key) {
  const cached = textCache.get(key);
  if (cached && cached.until > Date.now()) return cached.text;
  const { bucket } = requireStorage();
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const result = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const text = await result.Body.transformToString('utf8');
  // Finished VOD playlists never change; a short cache avoids an S3 round trip per viewer.
  if (textCache.size > 2000) textCache.clear();
  textCache.set(key, { text, until: Date.now() + 10 * 60 * 1000 });
  return text;
}

async function headObject(key) {
  const { bucket } = requireStorage();
  const { HeadObjectCommand } = require('@aws-sdk/client-s3');
  try { return await s3().send(new HeadObjectCommand({ Bucket: bucket, Key: key })); }
  catch (error) { if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return null; throw error; }
}

async function deleteObject(key) {
  const { bucket } = requireStorage();
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

async function deletePrefix(prefix) {
  const { bucket } = requireStorage();
  if (!/^(hls|videos|downloads)\/[a-zA-Z0-9_.-]+/.test(prefix)) throw new Error('Refusing to delete an unsafe prefix');
  const { ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
  let token;
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    const keys = (page.Contents || []).map((o) => ({ Key: o.Key }));
    if (keys.length) await s3().send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

function encodeKey(key) { return key.split('/').map(encodeURIComponent).join('/'); }

// Content-Disposition for a download: ASCII fallback plus the exact UTF-8 name (RFC 6266).
function attachmentDisposition(name) {
  const clean = String(name).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180) || 'Anime Zone';
  const ascii = clean.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim() || 'Anime Zone';
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

// Signed delivery URL for one object. CloudFront when configured, otherwise an S3 presigned URL.
async function signedUrl(key, ttlSeconds = 4 * 3600, { download } = {}) {
  const c = requireStorage();
  if (c.cloudFrontReady && !download) {
    const { getSignedUrl } = require('@aws-sdk/cloudfront-signer');
    return getSignedUrl({ url: `${c.cdn}/${encodeKey(key)}`, keyPairId: c.keyPairId, privateKey: c.privateKey,
      dateLessThan: new Date(Date.now() + ttlSeconds * 1000).toISOString() });
  }
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: c.bucket, Key: key,
    ...(download ? { ResponseContentDisposition: attachmentDisposition(download) } : {}) }),
  { expiresIn: Math.min(ttlSeconds, 7 * 24 * 3600) });
}

// Rewrites a rendition playlist so each segment points at signed storage.
// CloudFront uses one wildcard policy limited to this rendition's segment prefix.
async function signPlaylist(text, playlistKey, ttlSeconds = 6 * 3600) {
  const c = requireStorage();
  const folder = playlistKey.replace(/[^/]+$/, '');
  const segmentPrefix = playlistKey.replace(/\.m3u8$/, '_');
  let query = null;
  if (c.cloudFrontReady) {
    const { getSignedUrl } = require('@aws-sdk/cloudfront-signer');
    const policy = JSON.stringify({ Statement: [{ Resource: `${c.cdn}/${encodeKey(segmentPrefix)}*`,
      Condition: { DateLessThan: { 'AWS:EpochTime': Math.floor(Date.now() / 1000) + ttlSeconds } } }] });
    const signed = getSignedUrl({ url: `${c.cdn}/${encodeKey(segmentPrefix)}*`, keyPairId: c.keyPairId, privateKey: c.privateKey, policy });
    query = new URL(signed).search;
  }
  const lines = text.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const name = line.trim();
    if (!name || name.startsWith('#')) { out.push(line); continue; }
    if (!/^[a-zA-Z0-9_-]+\.(ts|m4s|aac)$/.test(name) || !(folder + name).startsWith(segmentPrefix)) continue;
    out.push(query ? `${c.cdn}/${encodeKey(folder + name)}${query}` : await signedUrl(folder + name, ttlSeconds));
  }
  return out.join('\n');
}

// Browser-direct multipart upload helpers (admin uploads straight to S3).
async function createMultipart(key, type) {
  const { bucket } = requireStorage();
  const { CreateMultipartUploadCommand } = require('@aws-sdk/client-s3');
  const result = await s3().send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: type }));
  return result.UploadId;
}
async function signParts(key, uploadId, partNumbers) {
  const { bucket } = requireStorage();
  const { UploadPartCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  return Promise.all(partNumbers.map(async (n) => ({ partNumber: n,
    url: await getSignedUrl(s3(), new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: n }), { expiresIn: 3600 }) })));
}
async function completeMultipart(key, uploadId, parts) {
  const { bucket } = requireStorage();
  const { CompleteMultipartUploadCommand } = require('@aws-sdk/client-s3');
  await s3().send(new CompleteMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId,
    MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) } }));
}
async function abortMultipart(key, uploadId) {
  const { bucket } = requireStorage();
  const { AbortMultipartUploadCommand } = require('@aws-sdk/client-s3');
  await s3().send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
}

module.exports = {
  config, initializeCloud, registerObject, cloudObject, cloudSegmentKey, uploadFile, uploadDirectory, downloadFile,
  getText, headObject, deleteObject, deletePrefix, signedUrl, attachmentDisposition, signPlaylist, createMultipart, signParts, completeMultipart, abortMultipart, contentType,
};
