import fs from "fs/promises";
import path from "path";
import { existsSync, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const ALLOWED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const ALLOWED_VIDEO_EXTS = new Set([".mp4", ".webm", ".mkv", ".mov", ".avi", ".ts"]);
const run = promisify(execFile);

export async function validateSavedMedia(filePath: string, isVideo: boolean): Promise<void> {
  if (isVideo) {
    try {
      const { stdout } = await run("ffprobe", ["-v", "error", "-protocol_whitelist", "file", "-format_whitelist", "mov,matroska,webm,avi,mpegts", "-select_streams", "v:0", "-show_entries", "stream=codec_type", "-of", "json", filePath], { timeout: 30000 });
      if (!JSON.parse(stdout).streams?.some((stream: {codec_type?: string}) => stream.codec_type === "video")) throw new Error("Missing video stream");
      return;
    } catch { throw new Error("Uploaded file is not a valid video"); }
  }
  const handle = await fs.open(filePath, "r");
  try {
    const header = Buffer.alloc(16); const { bytesRead } = await handle.read(header, 0, 16, 0); const h = header.subarray(0, bytesRead);
    const valid = h.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) || h.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
      h.subarray(0, 6).toString("ascii").startsWith("GIF8") || (h.subarray(0, 4).toString("ascii") === "RIFF" && h.subarray(8, 12).toString("ascii") === "WEBP") ||
      (h.length >= 12 && h.subarray(4, 8).toString("ascii") === "ftyp");
    if (!valid) throw new Error("Uploaded file is not a valid image");
  } finally { await handle.close(); }
}

export async function saveUploadedFile(file: File, subfolder: string = ""): Promise<string> {
  if (!file || file.size === 0) {
    throw new Error("Empty or missing file provided");
  }

  // 1. Path traversal safe extraction
  const rawBasename = path.basename(file.name);
  const ext = path.extname(rawBasename).toLowerCase();

  // 2. Strict extension & type validation
  const isVideo = subfolder === "videos" || subfolder === "brand" || ALLOWED_VIDEO_EXTS.has(ext);
  const maximum = subfolder === "videos" ? 10 * 1024 ** 3 : subfolder === "brand" ? 250 * 1024 ** 2 : 20 * 1024 ** 2;
  if (file.size > maximum) throw new Error("Uploaded file exceeds the allowed size");
  if (isVideo) {
    if (!ALLOWED_VIDEO_EXTS.has(ext)) {
      throw new Error(`Invalid video format (${ext}). Allowed formats: mp4, webm, mkv, mov, avi, ts`);
    }
  } else {
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
      throw new Error(`Invalid image format (${ext}). Allowed formats: jpg, jpeg, png, webp, avif, gif`);
    }
  }

  // 3. Safe random unique filename
  const randomHash = crypto.randomBytes(8).toString("hex");
  const sanitizedName = rawBasename.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const filename = `${Date.now()}-${randomHash}-${sanitizedName}${ext}`;

  // 4. Ensure directory exists
  const uploadDir = path.join(process.cwd(), "public", "uploads", subfolder);
  if (!existsSync(uploadDir)) {
    await fs.mkdir(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, filename);

  // 5. Stream chunks to disk
  try {
    const webStream = file.stream();
    const nodeStream = Readable.fromWeb(webStream as any);
    const writeStream = createWriteStream(filePath);
    await pipeline(nodeStream, writeStream);
  } catch {
    const bytes = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(bytes));
  }

  try { await validateSavedMedia(filePath, isVideo); }
  catch (error) { await fs.unlink(filePath).catch(() => {}); throw error; }
  return subfolder ? `/uploads/${subfolder}/${filename}` : `/uploads/${filename}`;
}
