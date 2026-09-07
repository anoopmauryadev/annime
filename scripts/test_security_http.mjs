import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import ts from "typescript";

// Exercise the production router against disposable data, never the site's database.
const root = process.cwd();
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "anime-security-http-"));
const port = 3197;
let server;
let db;
let browser;
const require = createRequire(import.meta.url);
async function load(relative, overrides = {}) {
  const code = ts.transpileModule(await fs.readFile(path.join(root, relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)((id) => overrides[id] || require(id), loaded, loaded.exports);
  return loaded.exports;
}
function request(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: url, method, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("Request timed out")));
    req.end(body);
  });
}
try {
  for (const name of [".next", "node_modules", "package.json"]) await fs.symlink(path.join(root, name), path.join(temporary, name));
  await fs.copyFile(path.join(root, "next.config.ts"), path.join(temporary, "next.config.ts"));
  for (const [folder, name] of [["videos", "proof.mp4"], ["downloads", "proof.mp4"], ["temp", "proof.tmp"]]) {
    await fs.mkdir(path.join(temporary, "public/uploads", folder), { recursive: true });
    await fs.writeFile(path.join(temporary, "public/uploads", folder, name), "PRIVATE-MEDIA-PROOF");
  }
  process.chdir(temporary);
  process.env.ADMIN_SECRET_KEY = "isolated-http-security-fixture-secret-32-chars";
  const database = await load("src/lib/db.ts");
  const auth = await load("src/lib/auth.ts", { "@/lib/db": database });
  db = database.getDb();
  const user = database.createUser({ username: "audit_member", email: "audit@example.invalid", password: "test-fixture-password" });
  const userToken = auth.generateUserToken(user);
  const userHeaders = { Cookie: `user_token=${userToken}` };
  const admin = db.prepare("SELECT * FROM admin_users LIMIT 1").get();
  const adminHeaders = { Cookie: `admin_token=${auth.generateAdminToken(admin)}` };
  const episode = db.prepare("SELECT e.*, a.slug, s.season_number FROM episodes e JOIN anime a ON a.id=e.anime_id JOIN seasons s ON s.id=e.season_id LIMIT 1").get();
  const watchUrl = `/watch/${episode.slug}/${episode.season_number}x${episode.episode_number}`;
  db.prepare("DELETE FROM servers WHERE episode_id=?").run(episode.id);
  database.createServer({ episode_id: episode.id, server_name: "Security fixture", server_type: "direct", stream_url: "/uploads/videos/episode.mp4", server_order: 0 });
  await fs.mkdir("public/brand", { recursive: true });
  await fs.copyFile(path.join(root, "public/brand/anime-zone-intro-4k.mp4"), "public/brand/anime-zone-intro-4k.mp4");
  await fs.copyFile(path.join(root, "public/brand/anime-zone-intro-4k.mp4"), "public/uploads/videos/episode.mp4");
  process.chdir(root);
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
    "/uploads/videos/../downloads/proof.mp4", "/uploads/videos/%2e%2e/downloads/proof.mp4",
  ];
  const failures = [];
  for (const url of urls) {
    const response = await request(url);
    console.log(`${response.status} ${url}`);
    if (response.body.includes("PRIVATE-MEDIA-PROOF") || ![400, 401, 403, 404].includes(response.status)) failures.push(url);
  }
  assert.deepEqual(failures, [], "Anonymous requests must never receive private media or temporary uploads");
  for (const headers of [{ "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy" }, { "x-middleware-subrequest": "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy" }]) {
    assert.equal((await request("/uploads/videos/proof.mp4", { headers })).status, 401);
  }
  assert.equal((await request("/uploads/videos/proof.mp4", { headers: userHeaders })).status, 403);
  assert.deepEqual(JSON.parse((await request(`/api/episodes/${episode.id}`)).body).servers, []);
  assert.ok(!(await request(watchUrl)).body.includes("/uploads/videos/episode.mp4"), "SSR must not leak stream URL before authorization");

  let checked = 0;
  async function checkAdminRoutes(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await checkAdminRoutes(file);
      else if (entry.name === "route.ts") {
        const url = "/" + path.relative(path.join(root, "src/app"), path.dirname(file)).replaceAll("[id]", "1");
        const code = await fs.readFile(file, "utf8");
        for (const [, method] of code.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\(/g)) {
          if (url === "/api/admin/login" || (url === "/api/admin/brand-intro" && method === "GET") || (url === "/api/admin/session" && method === "DELETE")) continue;
          for (const headers of [{}, { Authorization: `Bearer ${userToken}` }]) {
            assert.equal((await request(url, { method, headers })).status, 401, `${method} ${url} must reject non-admin`);
            checked++;
          }
        }
      }
    }
  }
  await checkAdminRoutes(path.join(root, "src/app/api/admin"));
  assert.equal((await request("/api/admin/settings", { headers: adminHeaders })).status, 200);
  const mutation = { method: "POST", headers: { ...adminHeaders, "Content-Type": "text/plain", Origin: "http://evil.example.invalid", "Sec-Fetch-Site": "same-site" }, body: '{"maintenance_mode":"1"}' };
  assert.equal((await request("/api/admin/settings", mutation)).status, 401, "Same-site foreign origins cannot use admin cookies");
  assert.equal(database.getSiteSettings().maintenance_mode, undefined);
  const login = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${port}` }, body: JSON.stringify({ emailOrUsername: user.username, password: "test-fixture-password" }) });
  assert.equal(login.status, 200);
  assert.match(login.headers["set-cookie"].join(";"), /HttpOnly/);
  assert.match(login.headers["set-cookie"].join(";"), /Secure/);
  assert.equal(JSON.parse(login.body).token, undefined);
  assert.equal((await request("/api/auth/logout", { method: "POST", headers: { Origin: "http://evil.example.invalid", "Sec-Fetch-Site": "cross-site", Cookie: login.headers["set-cookie"].join(";") } })).status, 403);
  assert.equal((await request("/api/auth/logout", { method: "POST", headers: { Origin: `http://127.0.0.1:${port}`, Cookie: login.headers["set-cookie"].join(";") } })).status, 200);

  const episodeBytes = await fs.readFile(path.join(temporary, "public/uploads/videos/episode.mp4"));
  for (let index = 0; index < 2; index++) {
    const form = new FormData();
    const middle = Math.floor(episodeBytes.length / 2);
    form.set("chunk", new File([episodeBytes.subarray(index === 0 ? 0 : middle, index === 0 ? middle : undefined)], "episode.mp4"));
    form.set("uploadId", "security-fixture");
    form.set("chunkIndex", String(index));
    form.set("totalChunks", "2");
    form.set("fileName", "episode.mp4");
    const response = await fetch(`http://127.0.0.1:${port}/api/admin/upload-chunk`, { method: "POST", headers: adminHeaders, body: form });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.completed, index === 1);
    if (index === 0) {
      assert.equal((await fs.stat(path.join(temporary, `data/upload-temp/${admin.id}/security-fixture.tmp`))).size, middle);
    } else {
      assert.deepEqual(await fs.readFile(path.join(temporary, "public", result.videoUrl)), episodeBytes);
      assert.equal((await request(result.videoUrl)).status, 401);
    }
  }
  // Larger than Next proxy's default 10 MB: valid uploads must not be truncated.
  const picture = new FormData();
  picture.set("file", new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64"), Buffer.alloc(11 * 1024 ** 2)], "fixture.png"));
  const uploadedPicture = await fetch(`http://127.0.0.1:${port}/api/upload`, { method: "POST", headers: adminHeaders, body: picture });
  assert.equal(uploadedPicture.status, 200, "An authorized upload larger than 10 MB must remain intact");
  const pictureResult = await uploadedPicture.json();
  assert.ok((await fs.stat(path.join(temporary, "public", pictureResult.path))).size > 10 * 1024 ** 2);
  console.log("PASS: authenticated multi-chunk video upload, private staging, protected final file, and upload over 10 MB.");

  const accessKey = database.createAccessKey({ duration_hours: 1 });
  assert.equal(database.redeemAccessKey(accessKey.key_code, user.id).success, true);
  assert.equal((await request("/uploads/%76ideos/proof.mp4", { headers: { ...userHeaders, Range: "bytes=0-6" } })).status, 206);
  for (const url of ["/api/media/downloads%2fproof.mp4", "/api/media/videos%2f..%2fdownloads%2fproof.mp4", "/api/media/temp/proof.tmp"]) {
    assert.equal((await request(url, { headers: userHeaders })).status, 400, "Encoded segments must not downgrade VIP authorization");
  }
  assert.equal((await request("/uploads/downloads/proof.mp4", { headers: userHeaders })).status, 403);
  database.updateUserVipStatus(user.id, true);
  assert.equal((await request("/uploads/%64ownloads/proof.mp4", { headers: userHeaders })).status, 200);
  database.updateUserVipStatus(user.id, false);
  assert.equal((await request("/uploads/downloads/proof.mp4", { headers: userHeaders })).status, 403);
  database.revokeAccessKey(accessKey.id);
  assert.equal((await request("/uploads/videos/proof.mp4", { headers: userHeaders })).status, 403);
  db.prepare("UPDATE admin_users SET session_version=session_version+1 WHERE id=?").run(admin.id);
  assert.equal((await request("/api/admin/settings", { headers: adminHeaders })).status, 401);
  console.log(`PASS: ${checked} admin authorization requests; encoded media paths, SSR URL protection, CSRF rejection, real login, key/VIP grant and revocation.`);

  if (process.env.PLAYWRIGHT_MODULE) {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
    browser = await chromium.launch({ headless: true, channel: "chrome" });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}${watchUrl}`);
    await page.getByText("Sign In to Stream Episode").waitFor();
    await page.context().addCookies([{ name: "user_token", value: userToken, url: `http://127.0.0.1:${port}`, httpOnly: true, sameSite: "Strict" }]);
    await page.reload();
    await page.getByText("Unlock 48 Hours of Unlimited Anime").waitFor();
    database.updateUserVipStatus(user.id, true);
    await page.reload();
    await page.getByRole("button", { name: "Play episode", exact: true }).click();
    await page.locator("[data-custom-intro], .az-intro-playing").waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll("video")].some((video) => video.currentSrc.includes("/uploads/videos/episode.mp4") && video.currentTime > 0), undefined, { timeout: 15000 });
    console.log("PASS: browser login gate, key gate, VIP play, intro followed by actual protected video playback.");
  }
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  db?.close();
  process.chdir(root);
  await fs.rm(temporary, { recursive: true, force: true });
}
