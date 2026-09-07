// Isolated route tests with real signed tokens, files, FFmpeg and streamed responses.
// Membership/registry fixtures replace the production database; no real accounts change.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import ts from 'typescript';
const run = promisify(execFile);
const root = process.cwd();
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'az-download-check-'));
const require = createRequire(import.meta.url);
async function load(relative, overrides = {}) {
  const file = path.join(root, relative);
  const js = ts.transpileModule(await fs.readFile(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => overrides[id] || require(id), loaded, loaded.exports);
  return loaded.exports;
}
try {
  process.chdir(dir);
  await fs.mkdir('public/uploads/videos', { recursive: true });
  await fs.mkdir('public/brand', { recursive: true });
  process.env.ADMIN_SECRET_KEY = 'isolated-download-test-secret';
  const auth = await load('src/lib/auth.ts');
  const helper = await load('src/lib/introDownload.ts');
  // Exercise the real admin-grant and membership functions in a disposable DB.
  const database = await load('src/lib/db.ts');
  const db = database.getDb();
  db.prepare("INSERT INTO users (id,username,email,password_hash,is_vip) VALUES (999,'vip_test','vip_test@example.invalid','unused',0)").run();
  for (const grant of [
    () => database.updateUserVipStatus(999,true),
    () => database.setUserVipByEmail('vip_test@example.invalid',true),
    () => database.setUserVipByUsername('vip_test',true),
  ]) {
    db.prepare("UPDATE users SET is_vip=0,vip_expires_at='2000-01-01 00:00:00' WHERE id=999").run();
    assert.equal(grant(),true);
    assert.equal(database.isUserKeyActive(999).is_vip,true,'Admin VIP grant clears old expiry');
  }
  database.setSiteSetting('key_system_enabled','0');
  const keyRoute = await load('src/app/api/keys/status/route.ts',{'@/lib/auth':auth,'@/lib/db':database});
  const adminGrantedToken = auth.generateUserToken({id:999,username:'vip_test',email:'vip_test@example.invalid',is_vip:0});
  const check = await keyRoute.GET(new Request('http://localhost/api/keys/status',{headers:{Authorization:`Bearer ${adminGrantedToken}`}}));
  assert.equal((await check.json()).is_vip,true,'Disabling keys must not hide VIP status');
  db.close();
  const fixtureUrl = '/uploads/videos/test.webm';
  let membership = true;
  let introEnabled = '1';
  const route = await load('src/app/api/downloads/with-intro/route.ts', {
    '@/lib/auth': auth,
    '@/lib/introDownload': helper,
    '@/lib/db': {
      getDb: () => ({ prepare: () => ({ get: url => url === fixtureUrl || url === '/uploads/videos/missing.mp4' ? { exists: 1 } : undefined }) }),
      isUserKeyActive: () => ({ is_vip: membership }),
      getSiteSettings: () => ({ video_intro_download_enabled: introEnabled, video_intro_url: '/brand/intro.mp4' }),
    },
  });
  await run('ffmpeg', ['-y','-v','error','-f','lavfi','-i','color=c=red:s=320x180:r=30:d=0.8','-c:v','libx264','-pix_fmt','yuv420p','public/brand/intro.mp4']);
  await run('ffmpeg', ['-y','-v','error','-f','lavfi','-i','color=c=blue:s=320x180:r=25:d=2','-f','lavfi','-i','sine=frequency=440:duration=2','-f','lavfi','-i','sine=frequency=880:duration=2','-map','0:v','-map','1:a','-map','2:a','-c:v','libvpx-vp9','-c:a','libopus','-metadata:s:a:0','language=hin','-metadata:s:a:1','language=eng','public/uploads/videos/test.webm']);
  const token = auth.generateUserToken({ id: 1, username: 'Test', email: 'test@example.invalid', is_vip: 0 });
  const url = `http://localhost/api/downloads/with-intro?url=${encodeURIComponent(fixtureUrl)}`;
  const req = (extra = '', method = 'GET', extraHeaders = {}) => new Request(url + extra, { method, headers: { Authorization: `Bearer ${token}`, ...extraHeaders } });
  assert.equal((await route.GET(new Request(url))).status, 401);
  assert.equal((await route.GET(new Request(url, {headers:{Authorization:'Bearer invalid.token'}}))).status, 401);
  membership = false;
  assert.equal((await route.GET(req())).status, 403);
  membership = true;
  const before = await route.GET(req('&status=1'));
  assert.equal((await before.json()).status, 'pending');
  const started = await route.POST(req('', 'POST'));
  assert.equal(started.status, 202, 'Current VIP accepted despite non-VIP token');
  assert.equal((await (await route.POST(req('', 'POST'))).json()).status, 'processing', 'Duplicate shares job');
  let status;
  for (let i = 0; i < 100; i++) {
    status = await (await route.GET(req('&status=1'))).json();
    if (status.status === 'ready' || status.status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.equal(status.status, 'ready', JSON.stringify(status));
  const response = await route.GET(req());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /attachment;.*\.mp4/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length, Number(response.headers.get('content-length')));
  await fs.writeFile('download.mp4', bytes);
  const media = JSON.parse((await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json','download.mp4'])).stdout);
  assert.ok(Math.abs(Number(media.format.duration)-2.8)<0.2);
  assert.equal(media.streams.filter(s=>s.codec_type==='audio').length,2);
  assert.deepEqual(media.streams.filter(s=>s.codec_type==='audio').map(s=>s.tags.language),['hin','eng']);
  assert.equal(media.streams[0].width,320);
  // Confirm red intro precedes the blue episode, rather than only checking duration.
  for (const [time, channel] of [['0.3',0],['1.4',2]]) {
    const {stdout} = await run('ffmpeg',['-v','error','-ss',time,'-i','download.mp4','-vf','scale=1:1','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{encoding:'buffer'});
    assert.ok(stdout[channel]>150);
  }
  const part = await route.GET(req('', 'GET', { Range: 'bytes=0-99' }));
  assert.equal(part.status,206); assert.equal((await part.arrayBuffer()).byteLength,100);
  assert.equal((await route.GET(req('', 'GET', { Range: 'bytes=999999999-' }))).status,416);
  membership = false;
  assert.equal((await route.GET(req())).status,403,'Revoked VIP cannot retrieve cached file');
  membership = true;
  introEnabled = '0';
  const original = await route.GET(req());
  assert.equal(original.headers.get('content-type'),'video/webm');
  assert.deepEqual(Buffer.from(await original.arrayBuffer()),await fs.readFile('public/uploads/videos/test.webm'));
  const missing = new Request('http://localhost/api/downloads/with-intro?url=/uploads/videos/missing.mp4',{headers:{Authorization:`Bearer ${token}`}});
  assert.equal((await route.GET(missing)).status,404);
  console.log('PASS: old token/new VIP, unauthorized/revoked VIP, preparation and deduplication, silent intro, multiple audio tracks, content order, duration, streaming/ranges, original download with intro OFF, missing file.');
} finally {
  process.chdir(root);
  await fs.rm(dir,{recursive:true,force:true});
}
