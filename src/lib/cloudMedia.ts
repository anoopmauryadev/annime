import fs from "fs";
import path from "path";
import { getDb, getSiteSettings } from "./db";
import * as aws from "../../scripts/cloud/aws.cjs";

export type UploadTarget = "vps" | "s3";
export type TranscodeEngine = "vps" | "mediaconvert";
export type PlaybackSource = "vps" | "cloud";

export function cloudSettings() {
  const s = getSiteSettings();
  const c = aws.config();
  return {
    uploadTarget: (s.upload_target === "s3" && c.storageReady ? "s3" : "vps") as UploadTarget,
    engine: (s.transcode_engine === "mediaconvert" && c.mediaConvertReady ? "mediaconvert" : "vps") as TranscodeEngine,
    playbackSource: (s.playback_source === "cloud" && c.storageReady ? "cloud" : "vps") as PlaybackSource,
    syncEnabled: s.cloud_sync_enabled === "1",
    deleteLocal: s.cloud_delete_local === "1",
    storageReady: c.storageReady,
    cloudFrontReady: c.cloudFrontReady,
    mediaConvertReady: c.mediaConvertReady,
    bucket: c.bucket,
    region: c.region,
    cdn: c.cdn,
  };
}

export function cloudObject(url: string): { path: string; object_key: string; size: number; layout: string } | null {
  return aws.cloudObject(getDb(), url);
}

export function localMediaExists(url: string): boolean {
  if (!url.startsWith("/uploads/") || url.includes("..")) return false;
  return fs.existsSync(path.join(process.cwd(), "public", url));
}

/** S3 key that should serve this URL right now, or null to serve from the VPS. */
export function cloudKeyFor(url: string): string | null {
  const settings = getSiteSettings();
  if (!aws.config().storageReady) return null;
  const local = localMediaExists(url);
  if (local && settings.playback_source !== "cloud") return null;
  const db = getDb();
  const row = aws.cloudObject(db, url);
  if (row) return row.object_key;
  if (/^\/uploads\/hls\/[^/]+\/[a-zA-Z0-9_-]+\.ts$/.test(url) && (!local || settings.playback_source === "cloud")) {
    return aws.cloudSegmentKey(db, url);
  }
  return null;
}

/** A video picked in the admin upload form: local file, or an object uploaded straight to S3. */
export async function resolveUploadedVideo(videoUrl: string) {
  const name = videoUrl.startsWith("/uploads/videos/") ? videoUrl.slice("/uploads/videos/".length) : "";
  if (!/^[a-zA-Z0-9_.-]+\.(mp4|webm|mkv|mov|avi|ts)$/i.test(name) || name.startsWith(".")) {
    throw new Error("Select a locally uploaded video");
  }
  const videoRoot = path.join(process.cwd(), "public", "uploads", "videos");
  const absolutePath = path.join(videoRoot, name);
  if (fs.existsSync(absolutePath)) {
    const real = await fs.promises.realpath(absolutePath);
    if (!real.startsWith((await fs.promises.realpath(videoRoot)) + path.sep) || !(await fs.promises.stat(real)).isFile()) {
      throw new Error("Invalid uploaded video path");
    }
    return { absolutePath: real, sourceKey: aws.cloudObject(getDb(), videoUrl)?.object_key || null, size: (await fs.promises.stat(real)).size };
  }
  const row = aws.cloudObject(getDb(), videoUrl);
  if (!row) throw new Error("Invalid uploaded video path");
  return { absolutePath, sourceKey: row.object_key as string, size: Number(row.size) || 0 };
}

export async function signedMediaUrl(key: string, options: { download?: string } = {}) {
  return aws.signedUrl(key, 6 * 3600, options);
}

export async function signedPlaylist(key: string) {
  return aws.signPlaylist(await aws.getText(key), key, 6 * 3600);
}

export async function cloudText(key: string) {
  return aws.getText(key);
}

/** Forget (and delete from S3, best effort) everything stored for a removed media URL. */
export function forgetCloudMedia(url?: string | null) {
  if (!url || !url.startsWith("/uploads/")) return;
  try {
    const db = getDb();
    const folder = /^\/uploads\/hls\/([a-zA-Z0-9_-]+)\//.exec(url)?.[1];
    const rows = folder
      ? db.prepare("SELECT path, object_key FROM cloud_objects WHERE path LIKE ?").all(`/uploads/hls/${folder}/%`) as { path: string; object_key: string }[]
      : db.prepare("SELECT path, object_key FROM cloud_objects WHERE path = ?").all(url) as { path: string; object_key: string }[];
    if (!rows.length) return;
    db.prepare(folder ? "DELETE FROM cloud_objects WHERE path LIKE ?" : "DELETE FROM cloud_objects WHERE path = ?").run(folder ? `/uploads/hls/${folder}/%` : url);
    if (!aws.config().storageReady) return;
    const removal = folder ? aws.deletePrefix(`hls/${folder}/`) : aws.deleteObject(rows[0].object_key);
    removal.catch((error: unknown) => console.error("[Cloud] S3 delete failed", url, error));
  } catch (error) {
    console.error("[Cloud] Could not forget cloud media", url, error);
  }
}

/** Removes every HLS folder registered for an episode (ep_<id>_*). */
export function forgetEpisodeFolders(episodeId: number) {
  const prefix = `/uploads/hls/ep_${episodeId}_`;
  const rows = getDb().prepare("SELECT path FROM cloud_objects WHERE substr(path, 1, ?) = ? AND path LIKE '%/'")
    .all(prefix.length, prefix) as { path: string }[];
  for (const row of rows) forgetCloudMedia(row.path);
}

export const multipart = {
  create: aws.createMultipart,
  signParts: aws.signParts,
  complete: aws.completeMultipart,
  abort: aws.abortMultipart,
  head: aws.headObject,
  remove: aws.deleteObject,
  register: (url: string, key: string, size: number) => aws.registerObject(getDb(), url, key, size),
  contentType: aws.contentType,
};
