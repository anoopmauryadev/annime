/**
 * Client-side helper to upload large video files in 4MB chunks.
 * Bypasses reverse proxy body limits (Nginx, Cloudflare), prevents socket buffer stalls at 1.4MB,
 * and maintains low memory footprint on server.
 */
export async function uploadVideoInChunks(
  file: File,
  token: string,
  onProgress?: (pct: number, loadedMb: string, totalMb: string) => void,
  chunkSize: number = 4 * 1024 * 1024 // 4MB chunks
): Promise<string> {
  // Settings → Upload destination decides whether bytes go to the VPS or straight to AWS S3.
  const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const target = await fetch("/api/admin/s3-upload", { headers: auth, cache: "no-store" })
    .then((res) => (res.ok ? res.json() : { target: "vps" }))
    .catch(() => ({ target: "vps" }));
  if (target.target === "s3") return uploadVideoToS3(file, auth, onProgress);

  const totalChunks = Math.ceil(file.size / chunkSize);
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const totalMb = (file.size / (1024 * 1024)).toFixed(1);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunkBlob = file.slice(start, end);

    const fd = new FormData();
    fd.append("chunk", chunkBlob, file.name);
    fd.append("uploadId", uploadId);
    fd.append("chunkIndex", String(i));
    fd.append("totalChunks", String(totalChunks));
    fd.append("fileName", file.name);

    // Retry each chunk up to 3 times in case of cellular/mobile network glitch
    let retries = 3;
    let success = false;
    let lastError = "";
    let data: any = null;

    while (retries > 0 && !success) {
      try {
        const res = await fetch("/api/admin/upload-chunk", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });

        if (res.ok) {
          data = await res.json();
          success = true;
          break;
        } else {
          const errRes = await res.json().catch(() => ({}));
          lastError = errRes.error || `HTTP ${res.status}`;
          retries--;
          if (retries > 0) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
      } catch (networkErr: any) {
        lastError = networkErr.message || "Network glitch";
        retries--;
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
    }

    if (!success) {
      throw new Error(`Failed to upload chunk ${i + 1}/${totalChunks}: ${lastError}`);
    }

    const loadedBytes = end;
    const pct = Math.round((loadedBytes / file.size) * 100);
    const loadedMb = (loadedBytes / (1024 * 1024)).toFixed(1);

    if (onProgress) {
      onProgress(pct, loadedMb, totalMb);
    }

    if (data && data.completed && data.videoUrl) {
      return data.videoUrl;
    }
  }

  throw new Error("Upload finished all chunks but did not receive videoUrl from server");
}

async function s3Action(auth: Record<string, string>, body: Record<string, unknown>) {
  const res = await fetch("/api/admin/s3-upload", {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Direct browser → S3 multipart upload (4 parts in parallel, each retried 3 times). */
async function uploadVideoToS3(
  file: File,
  auth: Record<string, string>,
  onProgress?: (pct: number, loadedMb: string, totalMb: string) => void,
): Promise<string> {
  const { key, uploadId, partSize, totalParts } = await s3Action(auth, { action: "create", fileName: file.name, size: file.size });
  const totalMb = (file.size / (1024 * 1024)).toFixed(1);
  const done: { partNumber: number; etag: string }[] = [];
  let uploadedBytes = 0;
  let next = 1;

  const uploadPart = async (partNumber: number) => {
    const start = (partNumber - 1) * partSize;
    const blob = file.slice(start, Math.min(start + partSize, file.size));
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Signed URLs last an hour; sign each part right before sending it.
        const { urls } = await s3Action(auth, { action: "sign", key, uploadId, partNumbers: [partNumber] });
        const res = await fetch(urls[0].url, { method: "PUT", body: blob });
        const etag = res.headers.get("ETag");
        if (!res.ok) throw new Error(`S3 HTTP ${res.status}`);
        if (!etag) throw new Error("S3 did not expose the ETag header. Check the bucket CORS settings.");
        done.push({ partNumber, etag });
        uploadedBytes += blob.size;
        onProgress?.(Math.round((uploadedBytes / file.size) * 100), (uploadedBytes / (1024 * 1024)).toFixed(1), totalMb);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Network glitch";
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    throw new Error(`Failed to upload part ${partNumber}/${totalParts}: ${lastError}`);
  };

  try {
    await Promise.all(Array.from({ length: Math.min(4, totalParts) }, async () => {
      while (next <= totalParts) await uploadPart(next++);
    }));
    const result = await s3Action(auth, { action: "complete", key, uploadId, parts: done });
    return result.videoUrl;
  } catch (error) {
    await s3Action(auth, { action: "abort", key, uploadId }).catch(() => {});
    throw error;
  }
}
