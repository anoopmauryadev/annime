const fs=require('fs'), fsp=require('fs/promises'),path=require('path');
const {spawn}=require('child_process');
const {Readable}=require('stream');
const {pipeline}=require('stream/promises');
const {processMedia}=require('./transcode-engine.cjs');
const {digest,secret}=require('./cluster/protocol.cjs');
const {createQuota}=require('./cluster/quota.cjs');
const {limitedFile}=require('./cluster/transfer.cjs');
const origin=new URL(process.env.CLUSTER_ORIGIN);
if(origin.protocol!=='https:')throw Error('CLUSTER_ORIGIN must be HTTPS');
const nodeId=Number(process.env.NODE_ID),apiKey=secret(process.env.NODE_API_KEY);
if(!Number.isSafeInteger(nodeId)||nodeId<1)throw Error('Invalid NODE_ID');
const work=path.resolve(process.env.TRANSCODE_WORK_DIR||'data/remote-work');fs.mkdirSync(work,{recursive:true});
let stopping=false,child=null,quota=null,activeTransfer=null;
const headers={'x-api-key':apiKey,'x-node-id':String(nodeId)};
function url(job,extra={}){const u=new URL('/api/cluster/worker',origin);if(job){u.searchParams.set('id',job.id);u.searchParams.set('lease',job.lease);}for(const[k,v]of Object.entries(extra))u.searchParams.set(k,v);return u;}
async function post(body){const r=await fetch(url(),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`Coordinator rejected request (${r.status})`);return r.json();}
async function run(job){
 const directory=path.join(work,String(job.id)+'-'+job.lease),output=path.join(directory,'output'),input=path.join(directory,'source');await fsp.mkdir(output,{recursive:true});
 let info=null;
 let valid=true,paused=false,manualPause=false,recoveredAt=0,heartbeatBusy=false;
 const transfer=new AbortController();
 activeTransfer=transfer;
 const pulse=async()=>{
  if(heartbeatBusy)return;heartbeatBusy=true;
  try{
   const control=await post({action:'pulse',...job,info});
   if(control.manualPause){manualPause=true;valid=false;transfer.abort();if(child)child.kill('SIGTERM');}
   if(control.pause){paused=true;recoveredAt=0;}else if(paused){if(!recoveredAt)recoveredAt=Date.now();if(Date.now()-recoveredAt>30000)paused=false;}
   // Resource pressure lowers quota to 10% of one core; publication and leases continue.
   quota.update(paused?10:control.cpuQuota);
  }catch{valid=false;transfer.abort();if(child)child.kill('SIGTERM');}finally{heartbeatBusy=false;}
 };
 const timer=setInterval(()=>void pulse(),10000);
 try{
  await pulse();if(!valid)throw Error('Lease unavailable');
  const response=await fetch(url(job),{headers,redirect:'error',signal:AbortSignal.any([transfer.signal,AbortSignal.timeout(7200000)])});
  if(!response.ok||!response.body)throw Error('Source download failed');
  await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(input,{flags:'wx'}));
  const completed=await processMedia({input,output,threads:1,onlyQuality:job.quality,inspect:value=>{info=value;},progress:()=>{},publish:()=>{},run:args=>new Promise((resolve,reject)=>{
   if(stopping||!valid)return reject(Error('Job cancelled'));
   child=spawn('ffmpeg',['-hide_banner','-loglevel','error',...args],{stdio:['ignore','ignore','pipe'],windowsHide:true});let tail='';child.stderr.on('data',b=>{tail=(tail+b).slice(-1000);});child.once('error',reject);child.once('close',code=>{child=null;code===0?resolve():reject(Error(`FFmpeg ${code}: ${tail}`));});
  })});
  if(!valid||stopping)throw Error('Lease unavailable');
  if(job.quality!=='original'&&!completed.length){await post({action:'complete',...job,skipped:true});return;}
  for(const name of fs.readdirSync(output).filter(n=>n!=='master.m3u8'&&!n.startsWith('.'))){
   const file=path.join(output,name),size=fs.statSync(file).size;
   const r=await fetch(url(job,{name}),{method:'PUT',headers:{...headers,'x-content-sha256':await digest(file),'Content-Length':String(size),'Content-Type':'application/octet-stream'},body:limitedFile(file),duplex:'half',redirect:'error',signal:AbortSignal.any([transfer.signal,AbortSignal.timeout(7200000)])});
   if(!r.ok)throw Error(`Artifact upload failed (${r.status})`);
  }
  await post({action:'pulse',...job,info});
  await post({action:'complete',...job});
 }catch(error){await post({action:manualPause||stopping?'release':'failed',...job,error:error.message}).catch(()=>{});console.error(JSON.stringify({job:job.id,error:error.message}));}
 finally{clearInterval(timer);transfer.abort();activeTransfer=null;await fsp.rm(directory,{recursive:true,force:true});}
}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;activeTransfer?.abort();if(child)child.kill('SIGTERM');});
(async()=>{quota=await createQuota(100);while(!stopping){try{const {job,cpuQuota}=await post({action:'claim'});if(job){quota.update(cpuQuota);await run(job);}else await new Promise(r=>setTimeout(r,5000));}catch(error){console.error(error.message);await new Promise(r=>setTimeout(r,5000));}}quota.close();})().catch(e=>{console.error(e.message);process.exitCode=1;});
