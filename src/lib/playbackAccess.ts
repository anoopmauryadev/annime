import crypto from "crypto";
import { getDb, getSiteSettings, isUserKeyActive, getServersByEpisode } from "./db";
import { getUserFromRequest } from "./auth";
import fs from "fs";
import path from "path";

// A random HttpOnly browser identity; only its hash is persisted.
export function guestId(request: Request): string | null {
  const value = request.headers.get("cookie")?.match(/(?:^|;\s*)playback_guest=([a-f0-9]{64})(?:;|$)/)?.[1];
  return value ? crypto.createHash("sha256").update(value).digest("hex") : null;
}
export function guestTable() {
  return getDb();
}
export function playbackAccess(request: Request, episodeId?: number) {
  const user = getUserFromRequest(request);
  const settings = getSiteSettings();
  const member = user ? isUserKeyActive(user.id) : null;
  const browser = guestId(request);
  const guest = browser ? guestTable().prepare(`SELECT k.expires_at FROM access_keys k JOIN guest_keys g ON g.key_id=k.id
    WHERE g.browser_hash=? AND k.status='used' AND datetime(k.expires_at)>datetime('now') ORDER BY k.expires_at DESC LIMIT 1`).get(browser) as {expires_at: string} | undefined : undefined;
  const active = settings.key_system_enabled === "0" || !!member?.active || !!guest;
  const guest_mode = settings.playback_guest_mode || (settings.playback_login_required === "0" ? "all" : "login");
  const preview = guest_mode === "preview" && !!episodeId && isPreviewEpisode(episodeId);
  const login_required = guest_mode !== "all" && !preview;
  const expires_at = member?.active ? member.expires_at : guest?.expires_at || null;
  return { user, active, is_vip: !!member?.is_vip, login_required, guest_mode,
    can_download: !!user && (!!member?.is_vip || (settings.free_downloads_enabled === "1" && active)),
    allow_480p: !!member?.is_vip || settings.free_480p_enabled !== "0",
    original_enabled: member?.is_vip ? settings.vip_original_enabled !== "0" : settings.free_original_enabled === "1",
    can_play: active && (!login_required || !!user), key_system_disabled: settings.key_system_enabled === "0",
    expires_at, remaining_hours: expires_at ? Math.max(0, Math.ceil((Date.parse(expires_at.replace(" ", "T") + (expires_at.endsWith("Z") ? "" : "Z"))-Date.now())/3600000)) : 0 };
}
export function isPreviewEpisode(episodeId: number): boolean {
  // First two episodes across seasons, not a fresh quota for every browser.
  const rows = getDb().prepare(`SELECT e.id FROM episodes e JOIN seasons s ON s.id=e.season_id
    WHERE e.anime_id=(SELECT anime_id FROM episodes WHERE id=?)
    ORDER BY s.season_number,e.episode_number,e.id LIMIT 2`).all(episodeId) as {id:number}[];
  return rows.some(row=>row.id===episodeId);
}
export function mediaEpisodeId(parts: string[]): number | undefined {
  const url = '/uploads/' + parts.join('/');
  if(parts[0] === 'hls') {
    const folder = '/uploads/hls/' + parts[1] + '/';
    const row = getDb().prepare(`SELECT episode_id FROM servers WHERE stream_url IN (?,?,?)
      UNION SELECT s.episode_id FROM transcode_jobs j JOIN servers s ON s.id=j.server_id WHERE j.output_dir_name=? LIMIT 1`)
      .get(folder+'master.m3u8',folder+'360p.m3u8',folder+'480p.m3u8',parts[1]) as {episode_id:number} | undefined;
    return row?.episode_id;
  }
  return (getDb().prepare('SELECT episode_id FROM servers WHERE stream_url=? LIMIT 1').get(url) as {episode_id:number}|undefined)?.episode_id;
}
export function activateGuestKey(request: Request, keyId: number): {success:boolean;error?:string;duration_hours?:number;expires_at?:string} {
  const browser = guestId(request);
  if (!browser) return { success: false, error: "Open Get Key in this browser first." };
  const db = guestTable();
  return db.transaction(() => {
    const row = db.prepare(`SELECT k.*,g.browser_hash FROM access_keys k LEFT JOIN guest_keys g ON g.key_id=k.id WHERE k.id=?`).get(keyId) as {status:string;user_id:number|null;browser_hash:string|null;duration_hours:number;expires_at:string|null} | undefined;
    if (!row || row.user_id || (row.browser_hash && row.browser_hash !== browser) || row.status === "revoked") return {success:false,error:"This key is unavailable in this browser."};
    if (row.status === "used") return row.browser_hash === browser && row.expires_at && Date.parse(row.expires_at + "Z") > Date.now()
      ? {success:true,duration_hours:row.duration_hours,expires_at:row.expires_at} : {success:false,error:"Key already used or expired."};
    db.prepare("INSERT OR IGNORE INTO guest_keys(key_id,browser_hash) VALUES(?,?)").run(keyId,browser);
    db.prepare("UPDATE access_keys SET status='used',activated_at=datetime('now'),expires_at=datetime('now','+' || duration_hours || ' hours') WHERE id=? AND status='pending'").run(keyId);
    const done = db.prepare("SELECT duration_hours,expires_at FROM access_keys WHERE id=?").get(keyId) as {duration_hours:number;expires_at:string};
    return {success:true,...done};
  })();
}
export function localMediaUrl(url: string) {
  if (url.startsWith("/")) return url;
  try { const u = new URL(url); if (u.hostname.endsWith(".b-cdn.net") || u.origin === process.env.NEXT_PUBLIC_VIDEO_BASE_URL || u.origin === process.env.NEXT_PUBLIC_SITE_URL) return u.pathname; } catch {}
  return url;
}
export function mediaExists(url: string) {
  if (!url.startsWith("/uploads/") || url.includes("..")) return false;
  return fs.existsSync(path.join(process.cwd(), "public", url));
}
export function playbackServers(episodeId: number, access: ReturnType<typeof playbackAccess>) {
  if (!access.can_play) return [];
  const episodeServers = getServersByEpisode(episodeId);
  const result = episodeServers.flatMap(server => {
    const url = localMediaUrl(server.stream_url);
    if (url.startsWith("/uploads/hls/") && /\.m3u8$/i.test(url)) {
      const master = url.replace(/[^/]+$/, 'master.m3u8');
      const hasLow = ['360p.m3u8', ...(access.allow_480p ? ['480p.m3u8'] : [])].some(name=>mediaExists(url.replace(/[^/]+$/,name)));
      if (!hasLow) return [];
      const playable = mediaExists(master) ? master : ['360p.m3u8', ...(access.allow_480p ? ['480p.m3u8'] : [])].map(name=>url.replace(/[^/]+$/,name)).find(mediaExists) || url;
      if (!access.is_vip && !/\/(master|360p|480p)\.m3u8$/.test(playable)) return [];
      if (!access.allow_480p && playable.endsWith('/480p.m3u8')) return [];
      return mediaExists(playable) ? [{...server, stream_url:playable, server_name:access.allow_480p?"360p / 480p":"360p"}] : [];
    }
    // Originals and external players may expose HD, so they require VIP.
    if (!access.original_enabled) return [];
    if (url.startsWith("/uploads/videos/")) {
      // Only expose a verified original derivative after its conversion has finished.
      // A queued transcode job must not hide the uploaded browser-playable source.
      // With transcoding OFF no conversion is promised; browser-native MP4/WebM only.
      return /\.(mp4|webm)$/i.test(url) && mediaExists(url) ? [{...server,stream_url:url,server_name:access.is_vip ? "Original Quality (VIP)" : "Original Quality"}] : [];
    }
    return [{...server,stream_url:url}];
  });
  if (access.original_enabled) {
    const jobs = getDb().prepare(`SELECT j.output_dir_name FROM transcode_jobs j JOIN servers s ON s.id=j.server_id WHERE s.episode_id=? ORDER BY j.id DESC`).all(episodeId) as {output_dir_name:string}[];
    const original = jobs.map(j=>`/uploads/hls/${j.output_dir_name}/original.mp4`).find(mediaExists);
    if (original) result.push({id:-episodeId,episode_id:episodeId,server_name:"Original Quality (VIP)",server_type:"direct",stream_url:original,server_order:99});
    else if (!result.some(s=>s.server_name.startsWith('Original Quality'))) {
      const folders = [...new Set([
        ...episodeServers.map(s=>localMediaUrl(s.stream_url)).filter(url=>url.startsWith('/uploads/hls/')).map(url=>url.replace(/[^/]+$/,'')),
        ...jobs.map(j=>`/uploads/hls/${j.output_dir_name}/`),
      ])];
      for (const quality of [720,1080]) {
        const fallback=folders.map(folder=>folder+quality+'p.m3u8').find(url=>{
          if(!mediaExists(url))return false;
          const contents=fs.readFileSync(path.join(process.cwd(),'public',url),'utf8');
          return contents.startsWith('#EXTM3U') && contents.includes('#EXT-X-ENDLIST');
        });
        if(fallback) {
          result.push({id:-episodeId,episode_id:episodeId,server_name:`${quality}p HD (Original fallback)`,server_type:'direct',stream_url:fallback,server_order:99});
          break;
        }
      }
    }
  }
  return result;
}
