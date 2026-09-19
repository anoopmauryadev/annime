import {getDb} from '@/lib/db';
import {workerNode,leasedJob,sourceFile,staging,artifactName} from '@/lib/clusterWorker';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import {Readable,Transform} from 'stream';
import {pipeline} from 'stream/promises';
import {limitedFile} from '../../../../../scripts/cluster/transfer.cjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const node=workerNode(request);if(!node)return reply({error:'Unauthorized'},401);
 const u=new URL(request.url),job=leasedJob(node,Number(u.searchParams.get('id')),u.searchParams.get('lease')||'');
 if(!job)return reply({error:'Lease expired'},409);
 try{const file=sourceFile(job);return new Response(Readable.toWeb(limitedFile(file)) as ReadableStream,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(fs.statSync(file).size),'Cache-Control':'no-store'}});}catch{return reply({error:'Source unavailable'},404);}
}
export async function PUT(request:Request){
 const node=workerNode(request);if(!node)return reply({error:'Unauthorized'},401);
 const u=new URL(request.url),job=leasedJob(node,Number(u.searchParams.get('id')),u.searchParams.get('lease')||'');
 if(!job)return reply({error:'Lease expired'},409);
 const name=u.searchParams.get('name')||'',hash=request.headers.get('x-content-sha256')||'',size=Number(request.headers.get('content-length'));
 if(!artifactName(name,job.quality)||!(/^[a-f0-9]{64}$/).test(hash)||!Number.isSafeInteger(size)||size<=0||size>10*1024**3||!request.body)return reply({error:'Invalid artifact'},400);
 const dir=staging(job);await fsp.mkdir(dir,{recursive:true});const dest=path.join(dir,name),temp=dest+'.'+crypto.randomUUID()+'.partial';
 try{
  const sum=crypto.createHash('sha256');let count=0;
  const meter=new Transform({transform(chunk,enc,cb){count+=chunk.length;if(count>size)return cb(Error('Size exceeded'));sum.update(chunk);cb(null,chunk);}});
  await pipeline(Readable.fromWeb(request.body as import('stream/web').ReadableStream),meter,fs.createWriteStream(temp,{flags:'wx'}));
  if(count!==size||sum.digest('hex')!==hash)throw Error('Checksum mismatch');
  if(!leasedJob(node,job.id,job.lease))return reply({error:'Lease expired'},409);
  await fsp.rename(temp,dest);return reply({ok:true});
 }catch{return reply({error:'Artifact transfer failed'},400);}finally{await fsp.rm(temp,{force:true});}
}
export async function POST(request:Request){
 const node=workerNode(request);if(!node)return reply({error:'Unauthorized'},401);
 const db=getDb();
 try{
  if(Number(request.headers.get('content-length'))>16384)return reply({error:'Request too large'},413);
  const body=await request.json();
  const enabled=(db.prepare("SELECT value FROM site_settings WHERE key='cluster_transcoding_enabled'").get() as {value:string}|undefined)?.value==='1';
  if(body.action==='claim'){
   if(!enabled||!node.transcode_enabled||node.paused||node.last_seen<Date.now()-20000)return reply({job:null});
   const metrics=JSON.parse(node.metrics);
   if(metrics.cpu>75||metrics.mbps>node.max_mbps*0.6||metrics.diskFree<12*1024**3)return reply({job:null});
   const result=db.transaction(()=>{
    if(db.prepare("SELECT id FROM cluster_jobs WHERE node_id=? AND state='running' AND expires>?").get(node.id,Date.now()))return null;
    const available=db.prepare(`SELECT j.id,j.quality FROM cluster_jobs j JOIN transcode_jobs p ON p.id=j.parent_id WHERE j.state='pending' AND j.attempt<3 AND p.status='distributed'
      ORDER BY CASE j.quality WHEN '360p' THEN 0 WHEN '480p' THEN 1 ELSE 2 END,j.id`).all() as {id:number;quality:string}[];
    const next=available.find(j=>node.profiles.split(',').includes(j.quality));
    if(!next)return null;const lease=crypto.randomBytes(16).toString('hex');
    db.prepare("UPDATE cluster_jobs SET state='running',node_id=?,lease=?,expires=?,attempt=attempt+1 WHERE id=? AND state='pending'").run(node.id,lease,Date.now()+90000,next.id);
    return {...next,lease};
   }).immediate();
   return reply({job:result,cpuQuota:node.cpu_quota});
  }
  const job=leasedJob(node,Number(body.id),body.lease);
  if(!job)return reply({error:'Lease expired or cancelled'},409);
  if(body.action==='pulse'){
   if(body.info&&Number.isInteger(body.info.height)&&body.info.height>0&&body.info.height<=16384)db.prepare('UPDATE transcode_jobs SET actual_height=?,video_codec=?,audio_codec=?,quality_warning=? WHERE id=?').run(body.info.height,String(body.info.videoCodec||'').slice(0,32),String(body.info.audioCodec||'').slice(0,32),String(body.info.warning||'').slice(0,200),job.parent_id);
   const metrics=JSON.parse(node.metrics);const pause=!enabled||!!node.paused||node.last_seen<Date.now()-30000||metrics.cpu>90||metrics.mbps>node.max_mbps*0.8||metrics.diskFree<2*1024**3;
   db.prepare('UPDATE cluster_jobs SET expires=? WHERE id=? AND lease=?').run(Date.now()+90000,job.id,job.lease);
   return reply({pause,manualPause:!enabled||!!node.paused,cpuQuota:node.cpu_quota});
  }
  if(body.action==='failed'){
   db.prepare("UPDATE cluster_jobs SET state=CASE WHEN attempt<3 THEN 'pending' ELSE 'failed' END,error=?,expires=0 WHERE id=? AND lease=?").run(String(body.error||'Worker failed').slice(0,300),job.id,job.lease);return reply({ok:true});
  }
  if(body.action==='release'){
   db.prepare("UPDATE cluster_jobs SET state='pending',attempt=MAX(0,attempt-1),expires=0,error='Paused; rendition will restart on resume' WHERE id=? AND lease=?").run(job.id,job.lease);return reply({ok:true});
  }
  if(body.action!=='complete')return reply({error:'Unknown action'},400);
  const dir=staging(job);
  if(!/^[a-zA-Z0-9_-]+$/.test(job.output_dir_name))throw Error('Invalid output folder');
  const output=path.join(process.cwd(),'public/uploads/hls',job.output_dir_name);await fsp.mkdir(output,{recursive:true});
  if(body.skipped===true){
   // Never trust a skipped output as playable. It stays explicitly unavailable.
   db.prepare("UPDATE cluster_jobs SET state='skipped',error='Source below requested resolution',expires=0 WHERE id=? AND lease=?").run(job.id,job.lease);return reply({ok:true});
  }
  // Publication and the final lease check are one synchronous DB transaction.
  // Cancellation/lease recovery cannot race an awaited rename.
  db.transaction(()=>{
   if(!leasedJob(node,job.id,job.lease))throw Error('Lease expired before publication');
   if(job.quality==='original'){
    const file=path.join(dir,'original.mp4');if(!fs.statSync(file).size)throw Error('Missing original');
    if(!fs.existsSync(path.join(output,'original.mp4')))fs.renameSync(file,path.join(output,'original.mp4'));
   }else{
    const playlist=fs.readFileSync(path.join(dir,job.quality+'.m3u8'),'utf8');
    if(!playlist.startsWith('#EXTM3U')||!playlist.includes('#EXT-X-ENDLIST'))throw Error('Incomplete playlist');
    const names=playlist.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
    if(!names.length||names.some(n=>!artifactName(n,job.quality)||!n.endsWith('.ts')||!fs.existsSync(path.join(dir,n))||!fs.statSync(path.join(dir,n)).size))throw Error('Missing segment');
    const published=path.join(output,job.quality+'.m3u8');
    if(fs.existsSync(published)){
     const previous=fs.readFileSync(published,'utf8');
     const duration=(text:string)=>Array.from(text.matchAll(/#EXTINF:([\d.]+)/g)).reduce((sum,m)=>sum+Number(m[1]),0);
     const expected=duration(playlist),actual=duration(previous);
     const previousNames=previous.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
     if(!previous.includes('#EXT-X-ENDLIST')||expected<=0||Math.abs(actual-expected)>Math.max(2,expected*0.02)||!previousNames.length||previousNames.some(n=>!artifactName(n,job.quality)||!n.endsWith('.ts')||!fs.existsSync(path.join(output,n))||!fs.statSync(path.join(output,n)).size))throw Error('Existing rendition is incomplete; repair into a new output folder');
    }else{
     for(const name of names)fs.renameSync(path.join(dir,name),path.join(output,name));
     fs.renameSync(path.join(dir,job.quality+'.m3u8'),path.join(output,job.quality+'.m3u8'));
    }
    const profiles=[{name:'360p',w:640,h:360,b:950400},{name:'480p',w:854,h:480,b:1425600}];
    const master='#EXTM3U\n#EXT-X-VERSION:3\n'+profiles.filter(p=>fs.existsSync(path.join(output,p.name+'.m3u8'))).map(p=>`#EXT-X-STREAM-INF:BANDWIDTH=${p.b},RESOLUTION=${p.w}x${p.h}\n${p.name}.m3u8\n`).join('');
    fs.writeFileSync(path.join(output,'master.m3u8.tmp'),master);fs.renameSync(path.join(output,'master.m3u8.tmp'),path.join(output,'master.m3u8'));
    db.prepare("UPDATE servers SET stream_url=?,server_type='direct',server_name='360p / 480p' WHERE id=?").run(`/uploads/hls/${job.output_dir_name}/master.m3u8`,job.server_id);
   }
   db.prepare("UPDATE cluster_jobs SET state='complete',expires=0,error='' WHERE id=? AND lease=?").run(job.id,job.lease);
  }).immediate();
  await fsp.rm(dir,{recursive:true,force:true});return reply({ok:true});
 }catch(error){return reply({error:error instanceof Error?error.message:'Worker request failed'},400);}
}
