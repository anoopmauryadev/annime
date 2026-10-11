const assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const root=process.cwd();
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
Object.assign(process.env,{AWS_REGION:'ap-south-1',AWS_S3_BUCKET:'test-bucket',CLOUDFRONT_DOMAIN:'d123.cloudfront.net',CLOUDFRONT_KEY_PAIR_ID:'K2TEST',
  CLOUDFRONT_PRIVATE_KEY:privateKey.export({type:'pkcs1',format:'pem'}).replace(/\n/g,'\\n'),AWS_ACCESS_KEY_ID:'AKIAEXAMPLE',AWS_SECRET_ACCESS_KEY:'example'});
const aws=require(path.join(root,'scripts/cloud/aws.cjs'));
const fromB64=s=>Buffer.from(s.replace(/-/g,'+').replace(/_/g,'=').replace(/~/g,'/'),'base64');
(async()=>{
  const c=aws.config(); assert.ok(c.storageReady && c.cloudFrontReady && !c.mediaConvertReady);
  // ffmpeg layout
  const pl='#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4.0,\n360p_00000.ts\n#EXTINF:4.0,\n360p_00001.ts\n#EXTINF:2.0,\n../evil.ts\n720p_00000.ts\n#EXT-X-ENDLIST';
  const out=await aws.signPlaylist(pl,'hls/ep_1_9/360p.m3u8');
  const urls=out.split('\n').filter(l=>l.startsWith('https://'));
  assert.equal(urls.length,2,'only this rendition\'s segments survive');
  const u=new URL(urls[0]); assert.equal(u.origin+u.pathname,'https://d123.cloudfront.net/hls/ep_1_9/360p_00000.ts');
  const policy=fromB64(u.searchParams.get('Policy')).toString();
  assert.equal(JSON.parse(policy).Statement[0].Resource,'https://d123.cloudfront.net/hls/ep_1_9/360p_*');
  const ok=crypto.createVerify('RSA-SHA1').update(policy).verify(publicKey,fromB64(u.searchParams.get('Signature')));
  assert.ok(ok,'CloudFront signature verifies'); assert.equal(u.searchParams.get('Key-Pair-Id'),'K2TEST');
  assert.ok(out.includes('#EXT-X-ENDLIST'));
  // mediaconvert layout
  const mc=await aws.signPlaylist('#EXTM3U\n#EXTINF:4,\nmaster_480p_00001.ts\n#EXT-X-ENDLIST','hls/ep_2_1/master_480p.m3u8');
  const mu=new URL(mc.split('\n')[2]);
  assert.equal(mu.pathname,'/hls/ep_2_1/master_480p_00001.ts');
  assert.equal(JSON.parse(fromB64(mu.searchParams.get('Policy')).toString()).Statement[0].Resource,'https://d123.cloudfront.net/hls/ep_2_1/master_480p_*');
  // single object signed (canned) and download via S3 presign
  const one=new URL(await aws.signedUrl('hls/ep_1_9/original.mp4'));
  assert.equal(one.host,'d123.cloudfront.net'); assert.ok(one.searchParams.get('Expires') && one.searchParams.get('Signature'));
  const dl=new URL(await aws.signedUrl('videos/a.mp4',3600,{download:'anime zone"x.mp4'}));
  assert.ok(dl.host.startsWith('test-bucket.s3.'),dl.host);
  assert.equal(dl.searchParams.get('response-content-disposition'),'attachment; filename="anime_zone_x.mp4"');
  // registry + segment mapping
  const Database=require(path.join(root,'node_modules/better-sqlite3'));
  const db=new Database(':memory:'); db.exec("CREATE TABLE transcode_jobs(id INTEGER PRIMARY KEY)"); aws.initializeCloud(db); aws.initializeCloud(db);
  assert.ok(db.prepare('PRAGMA table_info(transcode_jobs)').all().some(c=>c.name==='engine'));
  aws.registerObject(db,'/uploads/hls/ep_2_1/','hls/ep_2_1/',0,'mediaconvert');
  aws.registerObject(db,'/uploads/hls/ep_1_9/','hls/ep_1_9/',0,'file');
  assert.equal(aws.cloudSegmentKey(db,'/uploads/hls/ep_2_1/480p_00001.ts'),'hls/ep_2_1/master_480p_00001.ts');
  assert.equal(aws.cloudSegmentKey(db,'/uploads/hls/ep_1_9/360p_00003.ts'),'hls/ep_1_9/360p_00003.ts');
  assert.equal(aws.cloudSegmentKey(db,'/uploads/hls/none/360p_00003.ts'),null);
  await assert.rejects(aws.deletePrefix('../'),/unsafe/); await assert.rejects(aws.deletePrefix('hls/'),/unsafe/);
  // master normalisation regex used by the media route
  const re=/^(?:master_)?(360p|480p)\.m3u8$/;
  assert.equal(re.exec('master_480p.m3u8')[1],'480p'); assert.equal(re.exec('360p.m3u8')[1],'360p'); assert.equal(re.exec('master_720p.m3u8'),null);
  // mediaconvert ladder
  const {renditionsFor}=require(path.join(root,'scripts/cloud/mediaconvert.cjs'));
  assert.deepEqual(renditionsFor({height:1080}).map(r=>r.name),['360p','480p','720p','1080p']);
  assert.deepEqual(renditionsFor({height:720}).map(r=>r.name),['360p','480p','720p']);
  assert.deepEqual(renditionsFor({height:240}).map(r=>r.name),['360p']);
  console.log('PASS: CloudFront wildcard signing per rendition, segment filtering, S3 download presign, registry/segment mapping, safe prefix delete, MediaConvert ladder.');
})().catch(e=>{console.error(e);process.exit(1);});
