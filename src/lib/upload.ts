import fs from "fs/promises";
import path from "path";
import { existsSync, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import crypto from "crypto";

const ALLOWED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const ALLOWED_VIDEO_EXTS = new Set([".mp4", ".webm", ".mkv", ".mov", ".avi"]);

export async function saveUploadedFile(file: File, subfolder: string = ""): Promise<string> {
  if (!file || file.size === 0) {
    throw new Error("Empty or missing file provided");
  }

  // 1. Path traversal safe extraction
  const rawBasename = path.basename(file.name);
  const ext = path.extname(rawBasename).toLowerCase();

  // 2. Strict extension & type validation
  const isVideo = subfolder === "videos" || ALLOWED_VIDEO_EXTS.has(ext);
  if (isVideo) {
    if (!ALLOWED_VIDEO_EXTS.has(ext)) {
      throw new Error(`Invalid video format (${ext}). Allowed formats: mp4, webm, mkv, mov, avi`);
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

  return subfolder ? `/uploads/${subfolder}/${filename}` : `/uploads/${filename}`;
}
