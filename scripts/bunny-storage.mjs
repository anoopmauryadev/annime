import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const storageZone = process.env.BUNNY_STORAGE_ZONE?.trim();
const storagePassword = process.env.BUNNY_STORAGE_PASSWORD?.trim();
const storageHost = (process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com").trim();

function requireConfiguration() {
  if (!storageZone || !storagePassword) {
    throw new Error("Set BUNNY_STORAGE_ZONE and BUNNY_STORAGE_PASSWORD.");
  }
}

async function* filesUnder(directory) {
  for await (const entry of await fsp.opendir(directory)) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* filesUnder(absolute);
    else if (entry.isFile()) yield absolute;
  }
}

function remoteUrl(remotePath) {
  const encodedPath = remotePath.split(path.sep).map(encodeURIComponent).join("/");
  return `https://${storageHost}/${encodeURIComponent(storageZone)}/${encodedPath}`;
}

async function uploadFile(localFile, remotePath) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(remoteUrl(remotePath), {
        method: "PUT",
        headers: { AccessKey: storagePassword, "Content-Type": "application/octet-stream" },
        body: fs.createReadStream(localFile),
        duplex: "half",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

export async function uploadHlsDirectory(localDirectory, outputDirName) {
  requireConfiguration();
  if (!/^[a-zA-Z0-9_-]+$/.test(outputDirName)) throw new Error("Invalid HLS directory name");
  let uploaded = 0;
  for await (const localFile of filesUnder(localDirectory)) {
    const relative = path.relative(localDirectory, localFile);
    await uploadFile(localFile, path.join("uploads", "hls", outputDirName, relative));
    uploaded++;
  }
  return uploaded;
}

async function migrateAll() {
  requireConfiguration();
  const hlsRoot = path.resolve(process.argv[2] || path.join(process.cwd(), "public", "uploads", "hls"));
  const stat = await fsp.stat(hlsRoot);
  if (!stat.isDirectory()) throw new Error(`Not a directory: ${hlsRoot}`);
  let directories = 0;
  for (const entry of await fsp.readdir(hlsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-zA-Z0-9_-]+$/.test(entry.name)) continue;
    const count = await uploadHlsDirectory(path.join(hlsRoot, entry.name), entry.name);
    directories++;
    console.log(`Uploaded ${entry.name}: ${count} files`);
  }
  console.log(`Migration complete: ${directories} HLS directories uploaded.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  migrateAll().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
