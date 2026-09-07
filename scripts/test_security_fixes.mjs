import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

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

  const uploadLibrary = await load("src/lib/upload.ts");
  await assert.rejects(
    uploadLibrary.saveUploadedFile(new File(["not media"], "fake.mp4"), "videos"),
    /not a valid video/,
  );

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

  db.close();

  console.log("PASS: token roles, malformed tokens, upload auth/content validation, disabled HTML proxy, bound key claims, key revocation, protected media auth.");
} finally {
  process.chdir(root);
  await fs.rm(temporary, { recursive: true, force: true });
}
