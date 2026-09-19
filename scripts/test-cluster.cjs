const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),fsp=require('fs/promises'),os=require('os'),path=require('path'),crypto=require('crypto');
const {spawn}=require('child_process');
const {once}=require('events');
const {sign,verify,safePath}=require('./cluster/protocol.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'annime-cluster-'));
const key=crypto.randomBytes(32).toString('hex'),apiKey=crypto.randomBytes(32).toString('hex');
const port=Number(process.env.CLUSTER_TEST_PORT||3297),base=`http://127.0.0.1:${port}`;
let child;
after(async()=>{if(child){child.kill('SIGTERM');await once(child,'exit');}await fsp.rm(root,{recursive:true,force:true});});
test('Media capabilities are exact-file, expiring, and fail closed',()=>{
 const file='hls/ep_1/360p_00001.ts',token=sign(key,file);
 assert(verify(key,token,file));assert(!verify(key,token,'hls/ep_1/original.mp4'));
 assert(!verify(key,sign(key,file,-1),file));assert(!verify(key,token+'x',file));assert(!verify('bad',token,file));
 for(const input of ['../secret','hls/a/../../secret','hls/.hidden/file.ts','hls/a/360p.ts/extra','hls/a\\b/360p.ts'])assert(!safePath(input));
});
test('Replica service enforces authorization, checksums, immutable files, ranges and CORS',async()=>{
 child=spawn(process.execPath,[path.join(__dirname,'../deploy/media-node/server.js')],{env:{...process.env,PORT:String(port),MEDIA_DIR:root,NODE_API_KEY:apiKey,MEDIA_SIGNING_KEY:key,SITE_ORIGIN:'https://example.test'},stdio:['ignore','pipe','pipe']});
 let ready=false;for(let i=0;i<50;i++){try{await fetch(base+'/api/health');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert(ready,'node started');
 assert.equal((await fetch(base+'/api/health')).status,401);
 assert.equal((await fetch(base+'/api/health',{headers:{'x-api-key':apiKey}})).status,200);
 const file='hls/ep_1/360p_00001.ts',bytes=Buffer.from('test-media-segment');
 const put=async(data,hash=crypto.createHash('sha256').update(data).digest('hex'))=>fetch(base+'/api/upload?path='+file,{method:'PUT',headers:{'x-api-key':apiKey,'x-content-sha256':hash},body:data});
 assert.equal((await put(bytes)).status,201);assert.equal((await put(bytes)).status,200);assert.equal((await put(Buffer.from('other'))).status,409);
 assert.equal((await fetch(base+'/media/'+file)).status,403);
 const signed=base+'/media/'+file+'?token='+sign(key,file);
 let r=await fetch(signed,{headers:{Range:'bytes=0-3',Origin:'https://example.test'}});assert.equal(r.status,206);assert.equal(await r.text(),'test');assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://example.test');
 assert.equal((await fetch(signed,{headers:{Range:'bytes=999-'}})).status,416);
 assert.equal((await fetch(base+'/media/hls/ep_1/original.mp4?token='+sign(key,file))).status,403);
 await fsp.symlink(__filename,path.join(root,'hls/ep_1/480p_00001.ts'));
 assert.equal((await fetch(base+'/media/hls/ep_1/480p_00001.ts?token='+sign(key,'hls/ep_1/480p_00001.ts'))).status,404);
 r=await fetch(base+'/api/upload?path=hls/ep_1/480p_00002.ts',{method:'PUT',headers:{'x-api-key':apiKey,'x-content-sha256':'a'.repeat(64)},body:bytes});assert.equal(r.status,500);assert(!fs.existsSync(path.join(root,'hls/ep_1/480p_00002.ts')));
});
test('Cluster schema migration is repeatable and retains node controls',()=>{
 const Database=require('better-sqlite3'),{initializeCluster}=require('./cluster/schema.cjs');const db=new Database(':memory:');
 initializeCluster(db);initializeCluster(db);db.prepare('INSERT INTO cluster_nodes(name,url,api_key,signing_key) VALUES(?,?,?,?)').run('node','https://node.test',apiKey,key);
 assert.equal(db.prepare('SELECT enabled FROM cluster_nodes').get().enabled,0);db.close();
});
