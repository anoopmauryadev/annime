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
