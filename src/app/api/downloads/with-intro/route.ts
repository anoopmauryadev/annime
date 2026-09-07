import { getDb, getSiteSettings, isUserKeyActive } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { prepareIntroDownload } from "@/lib/introDownload";
import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

async function localFile(url: string, folder: string) {
  if (!url.startsWith(folder) || !/\.(mp4|webm|mkv|mov|avi)$/i.test(url)) throw new Error("Invalid local video path");
  const root = await fs.realpath(path.join(process.cwd(), "public", folder));
  const file = await fs.realpath(path.resolve(process.cwd(), "public", `.${url}`));
  if (!file.startsWith(root + path.sep) || !(await fs.stat(file)).isFile()) throw new Error("Invalid local video path");
  return file;
}

async function handle(request: Request, start: boolean) {
  let user;
  try { user = getUserFromRequest(request); } catch { /* malformed token */ }
  if (!user) return Response.json({ error: "Sign in to download this episode." }, { status: 401, headers });
  // VIP can change after login. The database also checks membership expiry.
  if (!isUserKeyActive(user.id).is_vip) return Response.json({ error: "An active VIP membership is required." }, { status: 403, headers });
  const query = new URL(request.url).searchParams;
  const url = query.get("url") || "";
  const known = getDb().prepare("SELECT 1 FROM downloads WHERE download_url = ? UNION ALL SELECT 1 FROM servers WHERE stream_url = ? LIMIT 1").get(url, url);
  if (!known) return Response.json({ error: "Download not found." }, { status: 404, headers });
  try {
    const source = await localFile(url, "/uploads/");
    const settings = getSiteSettings();
    let file = source;
    if (settings.video_intro_download_enabled === "1") {
      const introUrl = settings.video_intro_url || "/brand/anime-zone-intro-4k.mp4";
      const intro = await localFile(introUrl, introUrl.startsWith("/brand/") ? "/brand/" : "/uploads/");
      const result = await prepareIntroDownload(source, intro, start);
      if (result.status !== "ready") return Response.json({ status: result.status, error: "error" in result ? result.error : undefined }, { status: result.status === "failed" ? 503 : 202, headers });
      file = result.path!;
    }
    if (start || query.has("status")) return Response.json({ status: "ready" }, { headers });
    const size = (await fs.stat(file)).size;
    const range = request.headers.get("range");
    let begin = 0, end = size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
      begin = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      if (!Number.isSafeInteger(begin) || !Number.isSafeInteger(end) || begin > end || begin < 0) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    const ext = path.extname(file).toLowerCase();
    const name = `${path.basename(source, path.extname(source)).replace(/[^a-zA-Z0-9_-]/g, "_")}${ext}`;
    const body = Readable.toWeb(createReadStream(file, { start: begin, end })) as ReadableStream<Uint8Array>;
    return new Response(body, { status: range ? 206 : 200, headers: {
      ...headers, "Content-Type": ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : "application/octet-stream",
      "Content-Disposition": `attachment; filename="anime-zone-${name}"`, "Content-Length": String(end - begin + 1), "Accept-Ranges": "bytes",
      ...(range ? { "Content-Range": `bytes ${begin}-${end}/${size}` } : {}),
    } });
  } catch {
    return Response.json({ error: "The video or intro file is missing or unavailable on this server." }, { status: 404, headers });
  }
}

export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
