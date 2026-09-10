import { playbackAccess, mediaEpisodeId } from "@/lib/playbackAccess";
import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contentTypes: Record<string, string> = {
  ".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska",
  ".m3u8": "application/vnd.apple.mpegurl", ".ts": "video/mp2t", ".vtt": "text/vtt",
};

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path;
  if (!Array.isArray(parts) || parts.length < 2 || !["videos", "hls", "downloads"].includes(parts[0]) ||
      parts.some((part) => !part || part === "." || part === ".." || /[/\\\0]/.test(part))) {
    return Response.json({ error: "Invalid media path" }, { status: 400 });
  }
  const fileName = parts.at(-1) || "";
  const access = playbackAccess(request, mediaEpisodeId(parts));
  if (parts.some(part => part.startsWith('.'))) return new Response(null,{status:404});
  const freeHls = parts[0] === 'hls' && parts.length === 3 && /^(master\.m3u8|(?:360p|480p)(?:\.m3u8|_\d+\.ts))$/.test(fileName);
  if (!access.can_play) return Response.json({error:access.active ? "Login required" : "Active key required"},{status:403});
  if (!freeHls && !access.is_vip) return Response.json({error:"VIP required"},{status:403});
  if (!access.allow_480p && /^480p[_.]/.test(fileName)) return Response.json({error:"480p requires VIP"},{status:403});
  if ((parts[0] === 'videos' || fileName === 'original.mp4') && !access.original_enabled) return Response.json({error:"Original playback disabled"},{status:403});
  const relative = parts.join(path.sep);
  const roots = [path.join(process.cwd(), "data", "media"), path.join(process.cwd(), "public", "uploads")];
  let file = "";
  for (const root of roots) {
    try {
      const candidate = await fs.realpath(path.join(root, relative));
      const canonicalRoot = await fs.realpath(root);
      if (candidate.startsWith(canonicalRoot + path.sep) && (await fs.stat(candidate)).isFile()) { file = candidate; break; }
    } catch {}
  }
  if (!file) return Response.json({ error: "Media not found" }, { status: 404 });

  if (fileName === 'master.m3u8') {
    // Never expose old HD variants through the free adaptive playlist.
    const lines=(await fs.readFile(file,'utf8')).split(/\r?\n/);
    const selected=['#EXTM3U','#EXT-X-VERSION:3'];
    for(let i=0;i<lines.length-1;i++) {
      if(lines[i].startsWith('#EXT-X-STREAM-INF:') && /^(360p|480p)\.m3u8$/.test(lines[i+1].trim()) && (access.allow_480p || lines[i+1].trim() === '360p.m3u8')) selected.push(lines[i],lines[i+1]);
    }
    if(selected.length===2) return Response.json({error:'Video processing'},{status:503});
    return new Response(selected.join('\n')+'\n',{headers:{'Content-Type':'application/vnd.apple.mpegurl','Cache-Control':'private, no-store'}});
  }
  const size = (await fs.stat(file)).size;
  const range = request.headers.get("range");
  let start = 0, end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    end = match[2] && match[1] ? Math.min(Number(match[2]), end) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
  }
  const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(body, { status: range ? 206 : 200, headers: {
    "Content-Type": contentTypes[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  } });
}
