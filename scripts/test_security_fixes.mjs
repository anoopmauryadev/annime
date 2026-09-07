import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const root = process.cwd();
const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "anime-zone-security-"));
async function load(relative, overrides = {}) {
  const code = ts.transpileModule(await fs.readFile(path.join(root, relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)((id) => overrides[id] || require(id), loaded, loaded.exports);
  return loaded.exports;
}

try {
  process.chdir(temporary);
  process.env.ADMIN_SECRET_KEY = "isolated-security-test-secret-at-least-32-characters";
  const databaseModule = await load("src/lib/db.ts");
  const auth = await load("src/lib/auth.ts", { "@/lib/db": databaseModule });
  const userToken = auth.generateUserToken({ id: 7, username: "member", email: "member@example.invalid" });
  assert.equal(auth.verifyAdminToken(userToken), null, "user token must not verify as admin");
  assert.equal(auth.verifyUserToken("x.y"), null, "malformed signature must fail closed");
  const admin = databaseModule.getDb().prepare("SELECT id, username, session_version FROM admin_users LIMIT 1").get();
  const adminToken = auth.generateAdminToken(admin);
  assert.equal(auth.requireAdminAuth(new Request("http://site/api/admin", { headers: { authorization: `Bearer ${adminToken}` } })).authorized, true);
  assert.equal(auth.requireAdminAuth(new Request("http://site/api/admin", { headers: { authorization: `Bearer ${userToken}` } })).authorized, false);
  const db = databaseModule.getDb();
  db.prepare("INSERT INTO users (username,email,password_hash) VALUES ('key_user','key@example.invalid','unused')").run();
  const keyUser = db.prepare("SELECT id FROM users WHERE username='key_user'").get();
  const firstKey = databaseModule.createAccessKey({ duration_hours: 1 });
  const secondKey = databaseModule.createAccessKey({ duration_hours: 2 });
  assert.equal(databaseModule.redeemAccessKey(firstKey.key_code, keyUser.id).success, true);
  assert.equal(databaseModule.redeemAccessKey(secondKey.key_code, keyUser.id).success, true);
  databaseModule.revokeAccessKey(secondKey.id);
  const firstExpiry = db.prepare("SELECT expires_at FROM access_keys WHERE id=?").get(firstKey.id).expires_at;
  assert.equal(db.prepare("SELECT key_expires_at FROM users WHERE id=?").get(keyUser.id).key_expires_at, firstExpiry);

  for (const [label, revokedIndex, elapsedHours, expectedHours, remove] of [
    ["oldest", 0, 0, 5, false], ["middle", 1, 0, 51, false], ["latest", 2, 0, 50, false],
    ["delete-oldest", 0, 0, 5, true], ["partly-consumed", 0, 24, 5, false], ["already-expired", 0, 49, 4, false],
  ]) {
    const id = Number(db.prepare("INSERT INTO users (username,email,password_hash) VALUES (?,?, 'unused')").run(label, `${label}@example.invalid`).lastInsertRowid);
    const keys = [48, 2, 3].map((hours) => databaseModule.createAccessKey({ duration_hours: hours }));
    for (const accessKey of keys) assert.equal(databaseModule.redeemAccessKey(accessKey.key_code, id).success, true);
    if (elapsedHours) {
      db.prepare("UPDATE access_keys SET activated_at=datetime(activated_at, ?), expires_at=datetime(expires_at, ?) WHERE used_by_user_id=?").run(`-${elapsedHours} hours`, `-${elapsedHours} hours`, id);
      db.prepare("UPDATE users SET key_expires_at=datetime(key_expires_at, ?) WHERE id=?").run(`-${elapsedHours} hours`, id);
    }
    assert.equal((remove ? databaseModule.deleteAccessKey : databaseModule.revokeAccessKey)(keys[revokedIndex].id), true);
    const remaining = db.prepare("SELECT unixepoch(key_expires_at)-unixepoch('now') AS seconds FROM users WHERE id=?").get(id).seconds;
    assert.ok(Math.abs(remaining - expectedHours * 3600) <= 2, `${label}: expected ${expectedHours} hours, got ${remaining / 3600}`);
    if (!remove) {
      databaseModule.revokeAccessKey(keys[revokedIndex].id);
      const unchanged = db.prepare("SELECT unixepoch(key_expires_at)-unixepoch('now') AS seconds FROM users WHERE id=?").get(id).seconds;
      assert.ok(Math.abs(unchanged - remaining) <= 1, "Repeated revocation must not subtract time twice");
    }
  }
  const boundKey = databaseModule.createAccessKey({ user_id: keyUser.id, claim_token: "owner-only", duration_hours: 1 });
  assert.equal(databaseModule.redeemAccessKey(boundKey.key_code, keyUser.id + 1).success, false);
  assert.equal(databaseModule.claimAndActivateKey("owner-only", keyUser.id + 1).success, false);
  assert.equal(databaseModule.claimAndActivateKey("owner-only", keyUser.id).success, true);
  assert.equal(databaseModule.claimAndActivateKey("owner-only", keyUser.id + 1).success, false);

  const uploadLibrary = await load("src/lib/upload.ts");
  await assert.rejects(
    uploadLibrary.saveUploadedFile(new File(["not media"], "fake.mp4"), "videos"),
    /not a valid video/,
  );
  await promisify(execFile)("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=duration=0.1", "-c:a", "aac", path.join(temporary, "audio.mp4")]);
  await assert.rejects(uploadLibrary.validateSavedMedia(path.join(temporary, "audio.mp4"), true), /not a valid video/);
  await fs.writeFile(path.join(temporary, "playlist.mp4"), "ffconcat version 1.0\nfile 'audio.mp4'\n");
  await assert.rejects(uploadLibrary.validateSavedMedia(path.join(temporary, "playlist.mp4"), true), /not a valid video/);

  const cleanup = await load("src/lib/fileCleanup.ts", { "@/lib/db": databaseModule });
  await fs.mkdir("public/uploads-backup", { recursive: true });
  await fs.writeFile("public/uploads-backup/keep.txt", "preserve");
  assert.equal(cleanup.deleteLocalFileOrDir("/uploads/../uploads-backup/keep.txt"), false);
  assert.equal(await fs.readFile("public/uploads-backup/keep.txt", "utf8"), "preserve");
  assert.equal(cleanup.deleteLocalFileOrDir("/uploads/"), false);
  await fs.writeFile("public/uploads/videos/delete.mp4", "disposable");
  assert.equal(cleanup.deleteLocalFileOrDir("/uploads/videos/delete.mp4"), true);

  const limits = await load("src/lib/rateLimit.ts");
  for (const [relative, payload] of [["src/app/api/keys/redeem/route.ts", { key_code: "invalid" }], ["src/app/api/vip/redeem/route.ts", { code: "invalid" }]]) {
    const redeem = await load(relative, { "@/lib/auth": auth, "@/lib/db": databaseModule, "@/lib/rateLimit": limits });
    for (let i = 0; i < 11; i++) {
      const response = await redeem.POST(new NextRequest("http://site/api/redeem", { method: "POST", headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" }, body: JSON.stringify(payload) }));
      assert.equal(response.status, i < 10 ? 400 : 429);
    }
  }

  const upload = await load("src/app/api/upload/route.ts", {
    "@/lib/auth": { requireAdminAuth: () => ({ authorized: false }) },
    "@/lib/upload": { saveUploadedFile: () => { throw new Error("must not save"); } },
    "@/lib/rateLimit": { rateLimit: () => null },
  });
  assert.equal((await upload.POST(new Request("http://site/api/upload", { method: "POST" }))).status, 401);

  const disabledProxy = await load("src/app/api/player-proxy/route.ts");
  assert.equal((await disabledProxy.GET()).status, 410);

  let activated = 0;
  const pending = { status: "pending", user_id: 7, duration_hours: 48 };
  const claim = await load("src/app/api/keys/claim/route.ts", {
    "@/lib/auth": { getUserFromRequest: (request) => request.headers.get("x-test-user") ? { id: Number(request.headers.get("x-test-user")) } : null },
    "@/lib/db": {
      getKeyByClaimToken: () => pending,
      isUserKeyActive: () => ({ active: false }),
      claimAndActivateKey: () => { activated += 1; return { success: true, duration_hours: 48 }; },
    },
  });
  const claimUrl = "http://site/api/keys/claim?claim=secret";
  assert.equal((await claim.GET(new NextRequest(claimUrl))).status, 200);
  assert.equal(activated, 0, "GET must never activate a key");
  assert.equal((await claim.POST(new NextRequest(claimUrl, { method: "POST", body: "{}", headers: { "content-type": "application/json" } }))).status, 401);
  assert.equal((await claim.POST(new NextRequest(claimUrl, { method: "POST", body: "{}", headers: { "content-type": "application/json", "x-test-user": "8" } }))).status, 403);
  assert.equal(activated, 0);

  const media = await load("src/app/api/media/[...path]/route.ts", {
    "@/lib/auth": { getUserFromRequest: (request) => request.headers.get("x-test-user") ? { id: 7 } : null },
    "@/lib/db": { isUserKeyActive: () => ({ active: false, is_vip: false }) },
  });
  const context = { params: Promise.resolve({ path: ["videos", "episode.mp4"] }) };
  assert.equal((await media.GET(new Request("http://site/api/media/videos/episode.mp4"), context)).status, 401);
  assert.equal((await media.GET(new Request("http://site/api/media/videos/episode.mp4", { headers: { "x-test-user": "1" } }), context)).status, 403);

  databaseModule.setSiteSetting("backup_wal_fixture", "must survive migration");
  await fs.mkdir("src/lib", { recursive: true });
  await fs.copyFile(path.join(root, "src/lib/db.ts"), "src/lib/db.ts");
  await promisify(execFile)(process.execPath, [path.join(root, "scripts/apply_security_migration.mjs")], { cwd: temporary });
  const backupPath = path.join(temporary, "data/security-backup-20260908.db");
  const backup = new (require("better-sqlite3"))(backupPath, { readonly: true });
  assert.equal(backup.prepare("SELECT value FROM site_settings WHERE key='backup_wal_fixture'").get().value, "must survive migration");
  assert.equal(backup.pragma("integrity_check", { simple: true }), "ok");
  assert.equal((await fs.stat(backupPath)).mode & 0o777, 0o600);
  backup.close();
  db.close();

  console.log("PASS: token roles, upload/media validation, cleanup containment, redemption throttles, bound key claims, key revocation, protected media auth, live WAL database backup integrity.");
} finally {
  process.chdir(root);
  await fs.rm(temporary, { recursive: true, force: true });
}
