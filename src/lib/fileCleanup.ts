import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";

/**
 * Safely removes a file or directory from `public/uploads`.
 * Guarantees that only paths inside `public/uploads` are deleted, preventing directory traversal.
 */
export function deleteLocalFileOrDir(urlOrPath?: string | null): boolean {
  if (!urlOrPath || typeof urlOrPath !== "string") return false;

  // Only delete files under /uploads/
  if (!urlOrPath.startsWith("/uploads/")) return false;

  try {
    const cleanUrl = urlOrPath.split("?")[0].split("#")[0].trim();
    const uploadsIndex = cleanUrl.indexOf("/uploads/");
    if (uploadsIndex === -1) return false;

    const relPath = cleanUrl.substring(uploadsIndex); // e.g. /uploads/videos/... or /uploads/hls/...
    const normalized = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, "");

    // Check if this is an HLS playlist or segment within an HLS output folder
    if (normalized.includes("/uploads/hls/")) {
      const parts = normalized.split(/[\/\\]/).filter(Boolean);
      const hlsIdx = parts.indexOf("hls");
      if (hlsIdx !== -1 && parts.length > hlsIdx + 1) {
        const folderName = parts[hlsIdx + 1];
        if (folderName && folderName !== ".." && folderName !== ".") {
          const hlsDir = path.join(process.cwd(), "public", "uploads", "hls", folderName);
          const allowedRoot = path.join(process.cwd(), "public", "uploads", "hls");
          if (hlsDir.startsWith(allowedRoot + path.sep) && fs.existsSync(hlsDir) &&
              fs.realpathSync(hlsDir).startsWith(fs.realpathSync(allowedRoot) + path.sep)) {
            console.log(`[FileCleanup] Deleting HLS directory: ${hlsDir}`);
            fs.rmSync(hlsDir, { recursive: true, force: true });
            return true;
          }
        }
      }
    }

    // Normal file or directory removal
    const fullPath = path.join(process.cwd(), "public", normalized);
    const uploadsRoot = path.join(process.cwd(), "public", "uploads");

    // Security check: ensure path is strictly inside public/uploads
    if (!fullPath.startsWith(uploadsRoot + path.sep)) {
      console.warn(`[FileCleanup] Refused to delete path outside public/uploads: ${fullPath}`);
      return false;
    }

    if (fs.existsSync(fullPath)) {
      if (!fs.realpathSync(fullPath).startsWith(fs.realpathSync(uploadsRoot) + path.sep)) return false;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return false; // Only individual media files or the HLS folder above may be removed.
      } else {
        console.log(`[FileCleanup] Deleting file: ${fullPath}`);
        fs.unlinkSync(fullPath);
      }
      return true;
    }
  } catch (err) {
    console.error(`[FileCleanup] Error deleting ${urlOrPath}:`, err);
  }
  return false;
}

/**
 * Clean up physical video/HLS files and records when a stream server is deleted
 */
export function cleanupServerFiles(serverId: number) {
  try {
    const db = getDb();
    const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as any;
    if (server && server.stream_url) {
      deleteLocalFileOrDir(server.stream_url);
    }
    // Delete related transcode jobs
    db.prepare("DELETE FROM transcode_jobs WHERE server_id = ?").run(serverId);
    db.prepare("DELETE FROM server_reports WHERE server_id = ?").run(serverId);
  } catch (e) {
    console.error(`[FileCleanup] Error cleaning up server ${serverId}:`, e);
  }
}

/**
 * Clean up physical download file when a download link is deleted
 */
export function cleanupDownloadFiles(downloadId: number) {
  try {
    const db = getDb();
    const dl = db.prepare("SELECT * FROM downloads WHERE id = ?").get(downloadId) as any;
    if (dl && dl.download_url) {
      deleteLocalFileOrDir(dl.download_url);
    }
  } catch (e) {
    console.error(`[FileCleanup] Error cleaning up download ${downloadId}:`, e);
  }
}

/**
 * Clean up all video files, HLS folders, thumbnails, and child records when an episode is deleted
 */
export function cleanupEpisodeFiles(episodeId: number) {
  try {
    const db = getDb();
    const ep = db.prepare("SELECT * FROM episodes WHERE id = ?").get(episodeId) as any;
    if (!ep) return;

    // 1. Delete all servers and their video/HLS files
    const servers = db.prepare("SELECT * FROM servers WHERE episode_id = ?").all(episodeId) as any[];
    for (const s of servers) {
      if (s.stream_url) deleteLocalFileOrDir(s.stream_url);
    }
    db.prepare("DELETE FROM servers WHERE episode_id = ?").run(episodeId);

    // 2. Delete all downloads and their video files
    const downloads = db.prepare("SELECT * FROM downloads WHERE episode_id = ?").all(episodeId) as any[];
    for (const d of downloads) {
      if (d.download_url) deleteLocalFileOrDir(d.download_url);
    }
    db.prepare("DELETE FROM downloads WHERE episode_id = ?").run(episodeId);

    // 3. Delete episode thumbnail
    if (ep.thumbnail) {
      deleteLocalFileOrDir(ep.thumbnail);
    }

    // 4. Delete any matching HLS folder for this episode: ep_${episodeId}_*
    try {
      const hlsBase = path.join(process.cwd(), "public", "uploads", "hls");
      if (fs.existsSync(hlsBase)) {
        const prefix = `ep_${episodeId}_`;
        const entries = fs.readdirSync(hlsBase);
        for (const entry of entries) {
          if (entry.startsWith(prefix)) {
            const epDir = path.join(hlsBase, entry);
            console.log(`[FileCleanup] Deleting HLS folder for episode ${episodeId}: ${epDir}`);
            fs.rmSync(epDir, { recursive: true, force: true });
          }
        }
      }
    } catch {}

    // 5. Clean up associated db records
    db.prepare("DELETE FROM transcode_jobs WHERE episode_id = ?").run(episodeId);
    db.prepare("DELETE FROM server_reports WHERE episode_id = ?").run(episodeId);
    db.prepare("DELETE FROM episode_comments WHERE episode_id = ?").run(episodeId);
    db.prepare("DELETE FROM watch_history WHERE episode_id = ?").run(episodeId);
  } catch (e) {
    console.error(`[FileCleanup] Error cleaning up episode ${episodeId}:`, e);
  }
}

/**
 * Clean up all episodes, videos, and HLS folders when a season is deleted
 */
export function cleanupSeasonFiles(seasonId: number) {
  try {
    const db = getDb();
    const episodes = db.prepare("SELECT id FROM episodes WHERE season_id = ?").all(seasonId) as any[];
    for (const ep of episodes) {
      cleanupEpisodeFiles(ep.id);
      db.prepare("DELETE FROM episodes WHERE id = ?").run(ep.id);
    }
  } catch (e) {
    console.error(`[FileCleanup] Error cleaning up season ${seasonId}:`, e);
  }
}

/**
 * Clean up all posters, banners, seasons, episodes, videos, and HLS folders when an anime is deleted
 */
export function cleanupAnimeFiles(animeId: number) {
  try {
    const db = getDb();
    const anime = db.prepare("SELECT * FROM anime WHERE id = ?").get(animeId) as any;
    if (!anime) return;

    // 1. Delete image files (poster, backdrop, thumbnail)
    if (anime.poster) deleteLocalFileOrDir(anime.poster);
    if (anime.backdrop) deleteLocalFileOrDir(anime.backdrop);
    if (anime.thumbnail) deleteLocalFileOrDir(anime.thumbnail);

    // 2. Delete all seasons & their episodes/videos
    const seasons = db.prepare("SELECT id FROM seasons WHERE anime_id = ?").all(animeId) as any[];
    for (const s of seasons) {
      cleanupSeasonFiles(s.id);
      db.prepare("DELETE FROM seasons WHERE id = ?").run(s.id);
    }

    // 3. Delete any orphaned episodes directly under this anime_id
    const episodes = db.prepare("SELECT id FROM episodes WHERE anime_id = ?").all(animeId) as any[];
    for (const ep of episodes) {
      cleanupEpisodeFiles(ep.id);
      db.prepare("DELETE FROM episodes WHERE id = ?").run(ep.id);
    }

    // 4. Delete user bookmarks & comments
    try { db.prepare("DELETE FROM bookmarks WHERE anime_id = ?").run(animeId); } catch {}
    try { db.prepare("DELETE FROM comments WHERE anime_id = ?").run(animeId); } catch {}
  } catch (e) {
    console.error(`[FileCleanup] Error cleaning up anime ${animeId}:`, e);
  }
}
