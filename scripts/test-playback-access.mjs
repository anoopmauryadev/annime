import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import ts from 'typescript';
const root=process.cwd(), temp=await fs.mkdtemp(path.join(os.tmpdir(),'anime-playback-'));
const require=createRequire(import.meta.url), exec=promisify(execFile);
let server, db, browser;
async function load(file, overrides={}) {
  const code=ts.transpileModule(await fs.readFile(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const m={exports:{}};
  new Function('require','module','exports',code)(id=>overrides[id] || require(id),m,m.exports);
  return m.exports;
}
const base='http://127.0.0.1:3198';
async function call(url,cookie='',body=undefined) {
  return fetch(base+url,{method:body===undefined?'GET':'POST',headers:{cookie, ...(body===undefined?{}:{'content-type':'application/json',origin:base})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
}
try {
  for(const name of ['.next','node_modules','package.json','scripts']) await fs.symlink(path.join(root,name),path.join(temp,name));
  await fs.copyFile(path.join(root,'next.config.ts'),path.join(temp,'next.config.ts'));
  process.chdir(temp); process.env.ADMIN_SECRET_KEY='isolated-playback-test-secret-32-characters';
  const database=await load('src/lib/db.ts'); db=database.getDb();
  const auth=await load('src/lib/auth.ts',{'@/lib/db':database});
  const accessLib=await load('src/lib/playbackAccess.ts',{'./db':database,'./auth':auth});
  const user=database.createUser({username:'playback_test',email:'playback@example.invalid',password:'fixture-password'});
  const login=`user_token=${auth.generateUserToken(user)}`;
  const episode=db.prepare('SELECT * FROM episodes LIMIT 1').get();
  db.prepare('DELETE FROM servers WHERE episode_id=?').run(episode.id);
  const serverId=database.createServer({episode_id:episode.id,server_name:'fixture',server_type:'direct',stream_url:'/uploads/hls/fixture/master.m3u8',server_order:0});
  const output=path.join(temp,'public/uploads/hls/fixture'); await fs.mkdir(output,{recursive:true});
  await fs.mkdir(path.join(temp,'public/uploads/videos'),{recursive:true});
  const input=path.join(temp,'public/uploads/videos/test.mkv');
  await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=960x540:rate=12','-f','lavfi','-i','sine=frequency=500','-t','15','-c:v','mpeg4','-c:a','pcm_s16le',input]);
  const jobId=database.createTranscodeJob({server_id:serverId,status:'pending',input_path:input,output_dir_name:'fixture',master_url:'/uploads/hls/fixture/master.m3u8'});
  const {processMedia}=require(path.join(root,'scripts/transcode-engine.cjs'));
  let publications=0;
  await processMedia({input,output,threads:1,run:args=>exec('ffmpeg',['-v','error',...args]),progress:()=>{},publish:()=>{
    publications++;
    if(publications===1) {
      assert.ok(require('fs').existsSync(path.join(output,'360p.m3u8')));
      assert.ok(!require('fs').existsSync(path.join(output,'480p.m3u8')));
      assert.ok(!require('fs').existsSync(path.join(output,'original.mp4')));
    }
  }});
  assert.equal(publications,2);
  const probe=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',path.join(output,'original.mp4')])).stdout);
  assert.equal(probe.streams.find(s=>s.codec_type==='video').codec_name,'h264');
  assert.equal(probe.streams.find(s=>s.codec_type==='audio').codec_name,'aac');
  assert.equal(probe.streams.find(s=>s.codec_type==='video').height,540);
  // Retries must leave completed, currently playable files unchanged.
  const stamp=(await fs.stat(path.join(output,'360p.m3u8'))).mtimeMs;
  await processMedia({input,output,threads:1,run:()=>{throw Error('Unexpected re-encoding');},progress:()=>{},publish:()=>{}});
  assert.equal((await fs.stat(path.join(output,'360p.m3u8'))).mtimeMs,stamp);
  const selectedInput=path.join(temp,'selected360.mkv'),selectedOutput=path.join(temp,'selected360');
  await fs.mkdir(selectedOutput);
  await exec('ffmpeg',['-y','-v','error','-i',path.join(output,'360p.m3u8'),'-c','copy',selectedInput]);
  const selectedCommands=[];
  await processMedia({input:selectedInput,output:selectedOutput,sourceQuality:360,threads:1,run:args=>{selectedCommands.push(args);return exec('ffmpeg',['-v','error',...args]);},progress:()=>{},publish:()=>{}});
  assert.ok(selectedCommands.every(args=>args[args.indexOf('-c:v')+1]==='copy'),'Compatible selected source must not re-encode');
  assert.ok(!(await fs.readdir(selectedOutput)).includes('480p.m3u8'),'360p input must not be upscaled');
  let detected;
  await processMedia({input:selectedInput,output:selectedOutput,sourceQuality:1080,threads:1,inspect:info=>{detected=info;},run:()=>{throw Error('must not encode');},progress:()=>{},publish:()=>{}});
  assert.equal(detected.height,360);assert.match(detected.warning,/Selected 1080p; detected 360p/);
  const selectedProbe=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',path.join(selectedOutput,'original.mp4')])).stdout);
  assert.equal(selectedProbe.streams.find(s=>s.codec_type==='video').height,360);
  const tsInput=path.join(temp,'selected480.ts'),tsOutput=path.join(temp,'selected480');
  await fs.mkdir(tsOutput);
  await exec('ffmpeg',['-y','-v','error','-i',path.join(output,'480p.m3u8'),'-c','copy','-f','mpegts',tsInput]);
  const uploadLib=await load('src/lib/upload.ts');
  await uploadLib.validateSavedMedia(tsInput,true);
  const badTs=path.join(temp,'invalid.ts');await fs.writeFile(badTs,'not a video');
  await assert.rejects(uploadLib.validateSavedMedia(badTs,true),/not a valid video/);
  let first=true;
  await processMedia({input:tsInput,output:tsOutput,sourceQuality:360,threads:1,
    inspect:info=>{assert.equal(info.height,480);assert.ok(info.warning);},
    run:args=>{if(first)assert.equal(args[args.indexOf('-c:v')+1],'copy');return exec('ffmpeg',['-v','error',...args]);},
    progress:()=>{},publish:()=>{if(first){assert.ok(require('fs').existsSync(path.join(tsOutput,'480p.m3u8')));assert.ok(!require('fs').existsSync(path.join(tsOutput,'360p.m3u8')));first=false;}}});
  assert.ok(require('fs').existsSync(path.join(tsOutput,'360p.m3u8')));
  assert.ok(require('fs').existsSync(path.join(tsOutput,'original.mp4')));
  console.log('PASS: real TS validated, fake TS rejected, wrong selection corrected to 480p, source remuxed before 360p.');
  console.log('PASS: selected 360p MKV remuxed without video encoding, no upscale, playable Original and mismatched source corrected.');
  console.log('PASS: 360p published before 480p/original; incompatible MKV converted; source resolution retained; retry preserves renditions.');
  database.updateTranscodeJob(jobId,{status:'complete'});
  // Repair must include completed HLS jobs with missing renditions, without redoing 360p.
  await fs.unlink(path.join(output,'480p.m3u8'));
  const preview=await exec(process.execPath,[path.join(root,'scripts/repair-transcodes.cjs')],{cwd:temp});
  assert.ok(preview.stdout.includes('WOULD QUEUE'));
  assert.equal(db.prepare('SELECT status FROM transcode_jobs WHERE id=?').get(jobId).status,'complete');
  await exec(process.execPath,[path.join(root,'scripts/repair-transcodes.cjs'),'--apply'],{cwd:temp});
  assert.equal(db.prepare('SELECT status FROM transcode_jobs WHERE id=?').get(jobId).status,'pending');
  await exec(process.execPath,[path.join(root,'scripts/transcode-worker.js'),'--once'],{cwd:temp,env:{...process.env,TRANSCODE_THREADS:'1',BUNNY_STORAGE_ENABLED:'0'}});
  assert.equal(db.prepare('SELECT status FROM transcode_jobs WHERE id=?').get(jobId).status,'complete');
  assert.equal((await fs.stat(path.join(output,'360p.m3u8'))).mtimeMs,stamp);
  assert.ok((await fs.readFile(path.join(output,'480p.m3u8'),'utf8')).includes('#EXT-X-ENDLIST'));
  console.log('PASS: repair preview is read-only; completed HLS job requeued; real worker rebuilt missing 480p and retained 360p.');
  // A worker must acknowledge cancellation before cleanup unlinks its input.
  const cancelInput=path.join(temp,'public/uploads/videos/cancel.ts');await fs.copyFile(tsInput,cancelInput);
  const cancelServer=database.createServer({episode_id:episode.id,server_name:'cancel fixture',server_type:'direct',stream_url:'/uploads/videos/cancel.ts',server_order:9});
  const cancelJob=database.createTranscodeJob({server_id:cancelServer,status:'pending',input_path:cancelInput,output_dir_name:'cancel_fixture'});
  const fakeBin=path.join(temp,'fake-bin');await fs.mkdir(fakeBin);
  const began=path.join(temp,'ffmpeg-started'),ended=path.join(temp,'ffmpeg-ended');
  await fs.writeFile(path.join(fakeBin,'ffmpeg'),`#!/usr/bin/env node
const fs=require('fs');fs.writeFileSync(${JSON.stringify(began)},'started');
process.on('SIGTERM',()=>{fs.writeFileSync(${JSON.stringify(ended)},'stopped');process.exit(1);});setInterval(()=>{},1000);
`,{mode:0o755});
  const cancelWorker=spawn(process.execPath,[path.join(root,'scripts/transcode-worker.js'),'--once'],{cwd:temp,env:{...process.env,PATH:fakeBin+path.delimiter+process.env.PATH},stdio:'ignore'});
  try {
    for(let i=0;!require('fs').existsSync(began);i++){if(i>100)throw Error('Worker did not begin cancellation fixture');await new Promise(r=>setTimeout(r,100));}
    const cancels=await load('src/lib/cancelTranscodes.ts',{'./db':database});
    const cleanup=await load('src/lib/fileCleanup.ts',{'@/lib/db':database,'./cancelTranscodes':cancels});
    await cleanup.cleanupServerFiles(cancelServer);
    assert.ok(require('fs').existsSync(ended));
    assert.ok(!require('fs').existsSync(cancelInput));
    assert.equal(db.prepare('SELECT id FROM transcode_jobs WHERE id=?').get(cancelJob),undefined);
    database.deleteServer(cancelServer);
    console.log('PASS: active worker stopped and acknowledged before source deletion; cancelled job was not retried.');
  } finally {
    if(cancelWorker.exitCode===null){cancelWorker.kill('SIGTERM');await new Promise(r=>cancelWorker.once('exit',r));}
  }
  await fs.appendFile(path.join(output,'master.m3u8'),'#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080\n1080p.m3u8\n');
  await fs.writeFile(path.join(output,'1080p.m3u8'),'PRIVATE-HD');
  await fs.writeFile(path.join(output,'1080p_00000.ts'),'PRIVATE-HD');
  // Force a previously enabled CDN env; new default must still use local URLs.
  process.chdir(root);
  server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p','3198'],{cwd:temp,env:{...process.env,NODE_ENV:'production',TRANSCODE_WORKER_MODE:'external',BUNNY_CDN_ENABLED:'1',BUNNY_CDN_HOST:'https://example.b-cdn.net'},stdio:'pipe'});
  let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
  for(let i=0;;i++) {try {await call('/api/keys/status');break;} catch {if(i>80 || server.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,100));}}
  assert.equal((await call('/uploads/hls/fixture/master.m3u8')).status,403);
  const response=await call('/api/keys/status');
  const guest=response.headers.get('set-cookie').split(';')[0];
  const hash=crypto.createHash('sha256').update(guest.split('=')[1]).digest('hex');
  const key=database.createAccessKey({claim_token:crypto.randomBytes(24).toString('hex')});
  accessLib.guestTable().prepare('INSERT INTO guest_keys VALUES(?,?)').run(key.id,hash);
  assert.equal((await call('/api/keys/claim','',{claim_token:key.claim_token})).status,403);
  assert.equal((await call('/api/keys/redeem',login,{key_code:key.key_code})).status,400,'Logging in elsewhere must not take over a browser-bound guest key');
  assert.equal((await call('/api/keys/claim',guest,{claim_token:key.claim_token})).status,200);
  let status=await (await call('/api/keys/status',guest)).json();
  assert.equal(status.active,true);assert.equal(status.can_play,false);assert.equal(status.login_required,true);
  assert.equal((await call('/uploads/hls/fixture/360p.m3u8',guest)).status,403);
  const admin=db.prepare('SELECT * FROM admin_users LIMIT 1').get();
  const adminCookie=`admin_token=${auth.generateAdminToken(admin)}`;
  assert.equal((await call('/api/admin/transcode-status',guest,{server_id:serverId})).status,401);
  assert.equal((await call('/api/admin/transcode-status',adminCookie,{server_id:serverId})).status,409);
  const retryServer=database.createServer({episode_id:episode.id,server_name:'retry fixture',server_type:'direct',stream_url:'/uploads/videos/test.mkv',server_order:10});
  const retryJob=database.createTranscodeJob({server_id:retryServer,status:'failed',input_path:input,output_dir_name:'retry_fixture'});
  assert.equal((await call('/api/admin/transcode-status',adminCookie,{server_id:retryServer})).status,200);
  assert.equal(db.prepare('SELECT status FROM transcode_jobs WHERE id=?').get(retryJob).status,'pending');
  assert.equal((await call('/api/admin/transcode-status',adminCookie,{server_id:retryServer})).status,409);
  db.prepare("UPDATE transcode_jobs SET status='failed',input_path=? WHERE id=?").run(path.join(temp,'missing'),retryJob);
  assert.equal((await call('/api/admin/transcode-status',adminCookie,{server_id:retryServer})).status,409);
  db.prepare('DELETE FROM transcode_jobs WHERE id=?').run(retryJob);database.deleteServer(retryServer);
  console.log('PASS: admin retry queues failed job once, requires source, and rejects unauthenticated requests.');


  assert.equal((await call('/api/downloads',login)).status,403);
  assert.equal((await call('/api/admin/settings',adminCookie,{free_downloads_enabled:'1',key_system_enabled:'0'})).status,200);
  assert.equal((await call('/api/downloads',login)).status,200);
  const downloadId=database.createDownload({episode_id:episode.id,quality:'Source',download_url:'/uploads/videos/test.mkv'});
  const downloadPath='/api/downloads/with-intro?url='+encodeURIComponent('/uploads/videos/test.mkv');
  const fileResponse=await call(downloadPath,login);
  assert.equal(fileResponse.status,200);assert.ok((await fileResponse.arrayBuffer()).byteLength>0);
  assert.equal((await call(downloadPath,guest)).status,401);

  assert.equal((await call('/api/downloads',guest)).status,401);
  assert.equal((await (await call('/api/keys/status',login)).json()).can_download,true);
  assert.equal((await call('/api/admin/settings',adminCookie,{free_downloads_enabled:'0',key_system_enabled:'1'})).status,200);
  assert.equal((await call('/api/downloads',login)).status,403);
  assert.equal((await call(downloadPath,login)).status,403);
  db.prepare('DELETE FROM downloads WHERE id=?').run(downloadId);
  console.log('PASS: free downloads default denied, admin enable allows signed-in users, guests denied, disable revokes access.');

  const labelForm=new FormData();labelForm.set('display_quality','720p');
  assert.equal((await fetch(base+'/api/admin/episodes/'+episode.id,{method:'PUT',headers:{cookie:adminCookie,origin:base},body:labelForm})).status,200);
  assert.equal(database.getEpisodeById(episode.id).display_quality,'720p');
  assert.equal(db.prepare('SELECT source_quality FROM transcode_jobs WHERE id=?').get(jobId).source_quality,0);
  assert.equal((await call('/api/admin/settings',guest,{playback_login_required:'0'})).status,401);
  assert.equal((await call('/api/admin/settings',adminCookie,{playback_login_required:'0'})).status,200);
  status=await (await call('/api/keys/status',guest)).json();assert.equal(status.can_play,true);
  const playlist=await (await call('/uploads/hls/fixture/master.m3u8',guest)).text();
  assert.ok(playlist.includes('360p.m3u8'));assert.ok(playlist.includes('480p.m3u8'));assert.ok(!playlist.includes('1080p'));
  const segment=(await fs.readdir(output)).find(n=>n.startsWith('360p_') && n.endsWith('.ts'));
  assert.equal((await call('/uploads/hls/fixture/'+segment,guest)).status,200);
  for(const url of ['/uploads/hls/fixture/original.mp4','/uploads/hls/fixture/1080p.m3u8','/uploads/hls/fixture/1080p_00000.ts','/uploads/videos/test.mkv']) assert.equal((await call(url,guest)).status,403,url);
  assert.equal((await call('/uploads/hls/fixture/.original.partial.mp4',guest)).status,404);
  let data=await (await call('/api/episodes/'+episode.id,guest)).json();
  assert.ok(data.servers.length);assert.ok(data.servers.every(s=>s.stream_url.startsWith('/')));assert.deepEqual(data.downloads,[]);
  database.updateUserVipStatus(user.id,true);
  data=await (await call('/api/episodes/'+episode.id,login)).json();
  assert.ok(data.servers.some(s=>s.server_name==='Original Quality (VIP)'));
  const range=await fetch(base+'/uploads/hls/fixture/original.mp4',{headers:{cookie:login,range:'bytes=0-31'}});
  assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,32);
  // Old MKV conversions can supply HD even before low renditions or Original exist.
  await fs.copyFile(path.join(output,'360p.m3u8'),path.join(output,'720p.m3u8'));
  for(const name of ['original.mp4','360p.m3u8','480p.m3u8'])await fs.rename(path.join(output,name),path.join(temp,name));
  data=await (await call('/api/episodes/'+episode.id,login)).json();
  assert.equal(data.servers.length,1);
  assert.ok(data.servers[0].stream_url.endsWith('/720p.m3u8'));
  assert.equal((await call('/uploads/hls/fixture/720p.m3u8',guest)).status,403);
  database.setSiteSetting('free_original_enabled','1');
  assert.equal((await call('/uploads/hls/fixture/720p.m3u8',guest)).status,200);
  data=await (await call('/api/episodes/'+episode.id,guest)).json();
  assert.ok(data.servers.some(s=>s.stream_url.endsWith('/720p.m3u8')));
  database.setSiteSetting('vip_original_enabled','0');
  assert.equal((await call('/uploads/hls/fixture/720p.m3u8',login)).status,403);
  assert.equal((await call('/uploads/hls/fixture/720p.m3u8',guest)).status,200);
  database.setSiteSettings({vip_original_enabled:'1',free_original_enabled:'0'});
  for(const name of ['original.mp4','360p.m3u8','480p.m3u8'])await fs.rename(path.join(temp,name),path.join(output,name));
  console.log('PASS: MKV HD fallback before low renditions, guest HD denial, free HD toggle and independent VIP toggle.');
  database.updateUserVipStatus(user.id,false);
  assert.equal((await call('/uploads/hls/fixture/original.mp4',login)).status,403);
  db.prepare("UPDATE access_keys SET status='revoked' WHERE id=?").run(key.id);
  assert.equal((await call('/uploads/hls/fixture/360p.m3u8',guest)).status,403);
  database.setSiteSettings({key_system_enabled:'0',playback_login_required:'0'});
  assert.equal((await call('/uploads/hls/fixture/360p.m3u8')).status,200);
  assert.equal((await call('/uploads/hls/fixture/original.mp4')).status,403);
  database.setSiteSettings({playback_login_required:'1',playback_guest_mode:'login'});
  assert.equal((await call('/uploads/hls/fixture/360p.m3u8')).status,403);
  assert.equal((await call('/uploads/hls/fixture/360p.m3u8',login)).status,200);
  const cross=await fetch(base+'/api/keys/claim',{method:'POST',headers:{cookie:guest,origin:'https://other.invalid','content-type':'application/json'},body:JSON.stringify({claim_token:key.claim_token})});
  assert.equal(cross.status,403);
  const save=async body=>assert.equal((await call('/api/admin/settings',adminCookie,body)).status,200);
  await save({playback_guest_mode:'preview',free_480p_enabled:'0',vip_original_enabled:'0'});
  const previewEpisodes=db.prepare('SELECT e.id FROM episodes e JOIN seasons s ON s.id=e.season_id WHERE e.anime_id=? ORDER BY s.season_number,e.episode_number,e.id').all(episode.anime_id);
  assert.ok(previewEpisodes.length>=3,'Fixture needs three episodes');
  for(let i=0;i<3;i++) {
    const gate=await (await call('/api/keys/status?episode_id='+previewEpisodes[i].id,guest)).json();
    assert.equal(gate.can_play,i<2);
  }
  assert.equal((await call('/uploads/hls/fixture/360p.m3u8',guest)).status,200);
  assert.equal((await call('/uploads/hls/fixture/480p.m3u8',guest)).status,403);
  assert.ok(!(await (await call('/uploads/hls/fixture/master.m3u8',guest)).text()).includes('480p'));
  database.updateUserVipStatus(user.id,true);
  assert.equal((await call('/uploads/hls/fixture/480p.m3u8',login)).status,200);
  assert.equal((await call('/uploads/hls/fixture/original.mp4',login)).status,403);
  assert.ok(!(await (await call('/api/episodes/'+episode.id,login)).json()).servers.some(s=>s.stream_url.endsWith('original.mp4')));
  assert.equal((await call('/api/admin/settings',adminCookie,{playback_guest_mode:'both'})).status,400);
  await save({playback_guest_mode:'all',free_480p_enabled:'1',vip_original_enabled:'1'});
  assert.equal((await (await call('/api/keys/status?episode_id='+previewEpisodes[2].id,guest)).json()).can_play,true);
  await save({playback_guest_mode:'login'});
  assert.equal((await call('/uploads/hls/fixture/360p.m3u8',guest)).status,403);
  database.updateUserVipStatus(user.id,false);
  const analytics=await load('src/lib/videoAnalytics.ts',{'./db':database});
  const now=Date.now(),sample={session_id:crypto.randomUUID(),episode_id:episode.id,position:0,duration:120,state:'playing'};
  analytics.recordPresence(hash,null,now);
  assert.equal(analytics.recordPlayback(hash,null,sample,now),true);
  analytics.recordPlayback(hash,null,{...sample,position:10},now+10000);
  analytics.recordPlayback(hash,null,{...sample,position:90,state:'seeking'},now+11000);
  analytics.recordPlayback(hash,null,{...sample,position:90,state:'paused'},now+12000);
  assert.equal(analytics.recordPlayback('different-browser',null,sample,now+13000),false);
  assert.equal(db.prepare('SELECT watched_seconds FROM video_sessions WHERE id=?').get(sample.session_id).watched_seconds,10);
  assert.equal(analytics.videoAnalytics(7,episode.id).retention[0].watch_seconds,10);
  assert.equal(analytics.liveCounts(now+60000).activeUsers,0);
  assert.equal((await call('/api/admin/analytics',guest)).status,401);
  assert.equal((await call('/api/admin/analytics',adminCookie)).status,200);
  assert.equal((await call('/api/analytics/heartbeat',guest,sample)).status,403,'Guest tracking must obey login gate');
  await save({playback_guest_mode:'all'});
  const freshSample={...sample,session_id:crypto.randomUUID()};
  assert.equal((await call('/api/analytics/heartbeat',guest,freshSample)).status,200);
  assert.equal((await call('/api/analytics/heartbeat',guest,{...freshSample,position:-1})).status,400);
  assert.equal((await (await call('/api/admin/analytics',adminCookie)).json()).watchingUsers,1);
  console.log('PASS: preview first two, login/all modes, free 480p flag, VIP Original flag, analytics access, watch time, seek exclusion, identity ownership and live expiry.');
  console.log('PASS: guest key before login; admin login toggle; key OFF/ON; guest 360p/480p; HD/original denial; VIP range requests; revocation; local delivery; CSRF.');
  const watch=db.prepare('SELECT a.slug,s.season_number,e.episode_number FROM episodes e JOIN anime a ON a.id=e.anime_id JOIN seasons s ON s.id=e.season_id WHERE e.id=?').get(episode.id);
  const before=db.prepare('SELECT views FROM anime WHERE id=?').get(episode.anime_id).views;
  await call(`/watch/${watch.slug}/${watch.season_number}x${watch.episode_number}`);
  assert.ok(db.prepare('SELECT views FROM anime WHERE id=?').get(episode.anime_id).views>before);
  console.log('PASS: anonymous visit contributes to existing view count.');
  if (process.env.PLAYWRIGHT_MODULE) {
    const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
    browser=await chromium.launch({headless:true,channel:'chrome'});
    const page=await browser.newPage();
    page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const watchUrl=`${base}/watch/${watch.slug}/${watch.season_number}x${watch.episode_number}`;
    database.setSiteSettings({key_system_enabled:'1',playback_login_required:'1',playback_guest_mode:'login',video_intro_enabled:'0'});
    await page.context().addCookies([{name:'playback_guest',value:guest.split('=')[1],url:base,httpOnly:true,sameSite:'Lax'}]);
    await page.goto(watchUrl);
    await page.getByText('Unlock 48 Hours of Unlimited Anime').waitFor();
    assert.equal(await page.getByText('Sign In to Stream Episode').count(),0,'Key gate must appear before login');
    const browserKey=database.createAccessKey({claim_token:crypto.randomBytes(24).toString('hex')});
    accessLib.guestTable().prepare('INSERT INTO guest_keys VALUES(?,?)').run(browserKey.id,hash);
    await page.goto(base+'/verify-key?claim='+browserKey.claim_token);
    await page.getByText('48-Hour Pass Activated!',{exact:false}).waitFor();
    await page.goto(watchUrl);
    await page.getByText('Sign In to Stream Episode').waitFor();
    database.setSiteSettings({playback_login_required:'0',playback_guest_mode:'all'});
    await page.reload();
    await page.getByRole('button',{name:'Play episode',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.az-player-frame > video')?.currentTime>0);
    const controls=page.getByRole('region',{name:'Video player controls'});
    await controls.getByRole('button',{name:'Playback settings',exact:true}).click();
    await controls.getByRole('combobox',{name:'Video quality'}).selectOption('480');
    await page.waitForFunction(()=>document.querySelector('.az-player-frame > video')?.videoHeight===480);
    for(let i=0;;i++) {
      const recorded=db.prepare('SELECT COUNT(*) n FROM video_sessions WHERE id NOT IN (?,?) AND watched_seconds>0').get(sample.session_id,freshSample.session_id).n;
      if(recorded)break;
      assert.ok(i<150,'Actual browser playback must record watched time');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal(await controls.locator('option[value="-2"]').count(),1);
    assert.equal(await controls.locator('option[value="-2"]').evaluate(option=>option.disabled),true);
    assert.match(await controls.locator('option[value="-2"]').textContent(),/VIP required/);
    database.setSiteSetting('free_original_enabled','1');
    for(const name of ['original.mp4','360p.m3u8','480p.m3u8'])await fs.rename(path.join(output,name),path.join(temp,name));
    const hdRequests=[];
    const track=request=>{if(request.url().endsWith('/720p.m3u8'))hdRequests.push(request.url());};
    page.on('request',track);
    await page.reload();
    await page.getByRole('button',{name:'Choose 720p HD',exact:true}).waitFor();
    assert.equal(hdRequests.length,0,'Free Auto must not fetch HD before an explicit choice');
    await page.getByRole('button',{name:'Choose 720p HD',exact:true}).click();
    await page.getByRole('button',{name:'Play episode',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.az-player-frame > video')?.currentTime>0);
    assert.ok(hdRequests.length>0);
    page.off('request',track);
    for(const name of ['original.mp4','360p.m3u8','480p.m3u8'])await fs.rename(path.join(temp,name),path.join(output,name));
    database.setSiteSetting('free_original_enabled','0');
    database.updateUserVipStatus(user.id,true);
    await page.context().addCookies([{name:'user_token',value:login.split('=')[1],url:base,httpOnly:true,sameSite:'Strict'}]);
    await page.reload();
    await page.getByRole('button',{name:'Play episode',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.az-player-frame > video')?.currentTime>0);
    await controls.getByRole('button',{name:'Playback settings',exact:true}).click();
    await controls.getByRole('combobox',{name:'Video quality'}).selectOption('-2');
    await page.waitForFunction(()=>{const v=document.querySelector('.az-player-frame > video');return v?.currentSrc.endsWith('original.mp4') && v.videoHeight===540 && v.currentTime>0;});
    await controls.getByRole('button',{name:'Playback settings',exact:true}).click();
    await controls.getByRole('combobox',{name:'Video quality'}).selectOption('360');
    await page.waitForFunction(()=>document.querySelector('.az-player-frame > video')?.videoHeight===360);
    await page.context().addCookies([{name:'admin_token',value:adminCookie.split('=')[1],url:base,httpOnly:true,sameSite:'Strict'}]);
    await page.goto(base+'/admin/settings');
    const all=page.getByRole('switch',{name:'All episodes without login',exact:true});
    const preview=page.getByRole('switch',{name:'First 2 episodes without login',exact:true});
    await all.waitFor();
    await page.waitForFunction(()=>document.querySelector('[aria-label="All episodes without login"]')?.getAttribute('aria-checked')==='true');
    assert.equal(await preview.isDisabled(),true);
    await all.click();
    await preview.click();
    await page.waitForFunction(()=>document.querySelector('[aria-label="First 2 episodes without login"]')?.getAttribute('aria-checked')==='true');
    assert.equal(await all.isDisabled(),true);
    await page.goto(base+'/admin/analytics');
    await page.getByRole('heading',{name:'Video Analytics',exact:true}).waitFor();
    await page.getByText('Watching now',{exact:true}).waitFor();
    assert.equal(await page.locator('p[role="alert"]').count(),0);
    await page.goto(base+'/admin/anime/new');
    await page.getByLabel('Source quality (processing only)',{exact:false}).selectOption('360');
    await page.getByLabel('Display quality (shown to viewers)',{exact:false}).selectOption('720p');
    assert.equal(await page.getByLabel('Source quality (processing only)',{exact:false}).inputValue(),'360');
    await page.goto(base+'/admin/anime/'+episode.anime_id+'/episodes');
    await page.getByLabel('Source quality (processing only)',{exact:false}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: Chrome key-before-login, guest claim, guest HLS playback, 480p switch, VIP Original MP4, return to 360p, mutually exclusive guest switches and analytics page.');
  }
} finally {
  await browser?.close();
  if(server && server.exitCode===null) {server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}
  db?.close();process.chdir(root);await fs.rm(temp,{recursive:true,force:true});
}
