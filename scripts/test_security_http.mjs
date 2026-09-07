import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";

// Exercise the production router against disposable data, never the site's database.
const root = process.cwd();
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "anime-security-http-"));
const port = 3197;
let server;
function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path: url }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("Request timed out")));
  });
}
try {
  for (const name of [".next", "node_modules", "package.json"]) await fs.symlink(path.join(root, name), path.join(temporary, name));
  await fs.copyFile(path.join(root, "next.config.ts"), path.join(temporary, "next.config.ts"));
  for (const [folder, name] of [["videos", "proof.mp4"], ["downloads", "proof.mp4"], ["temp", "proof.tmp"]]) {
    await fs.mkdir(path.join(temporary, "public/uploads", folder), { recursive: true });
    await fs.writeFile(path.join(temporary, "public/uploads", folder, name), "PRIVATE-MEDIA-PROOF");
  }
  server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: temporary, env: { ...process.env, NODE_ENV: "production", ADMIN_SECRET_KEY: "isolated-http-security-fixture-secret-32-chars" }, stdio: "pipe",
  });
  let logs = "";
  server.stdout.on("data", (chunk) => { logs += chunk; });
  server.stderr.on("data", (chunk) => { logs += chunk; });
  for (let attempt = 0; ; attempt++) {
    try { await request("/api/player-proxy"); break; } catch {
      if (attempt > 80 || server.exitCode !== null) throw new Error(`Isolated server did not start: ${logs}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const urls = [
    "/uploads/videos/proof.mp4", "/uploads/%76ideos/proof.mp4", "/%75ploads/videos/proof.mp4",
    "/uploads%2fvideos%2fproof.mp4", "/uploads/downloads/proof.mp4", "/uploads/%64ownloads/proof.mp4",
    "/uploads/temp/proof.tmp", "/uploads/%74emp/proof.tmp",
  ];
  const failures = [];
  for (const url of urls) {
    const response = await request(url);
    console.log(`${response.status} ${url}`);
    if (response.body.includes("PRIVATE-MEDIA-PROOF") || ![400, 401, 403, 404].includes(response.status)) failures.push(url);
  }
  assert.deepEqual(failures, [], "Anonymous requests must never receive private media or temporary uploads");
  console.log("PASS: production HTTP media authorization, including encoded paths and legacy temporary uploads.");
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await fs.rm(temporary, { recursive: true, force: true });
}
