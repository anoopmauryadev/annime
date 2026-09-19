// Start from the repository root; this service never opens the website database.
const http=require('http'), fs=require('fs'), fsp=require('fs/promises'), path=require('path'), os=require('os'), crypto=require('crypto');
const {Transform}=require('stream');
const {pipeline}=require('stream/promises');
const {secret,equal,verify,safePath,resolveFile,digest}=require('../../scripts/cluster/protocol.cjs');
const API_KEY=secret(process.env.NODE_API_KEY), SIGNING_KEY=secret(process.env.MEDIA_SIGNING_KEY);
if(API_KEY===SIGNING_KEY)throw Error('Use distinct API and playback keys');
const ROOT=path.resolve(process.env.MEDIA_DIR||path.join(__dirname,'media'));
fs.mkdirSync(ROOT,{recursive:true,mode:0o700});
const origin=new URL(process.env.SITE_ORIGIN).origin;
let bytes=0, previousBytes=0, previousCpu=os.cpus(), cpu=0, mbps=0;
const activeUploads=new Set();
setInterval(()=>{const next=os.cpus();let idle=0,total=0;next.forEach((c,i)=>{const p=previousCpu[i]?.times;if(!p)return;idle+=c.times.idle-p.idle;for(const k of Object.keys(c.times))total+=c.times[k]-p[k];});cpu=total?100*(1-idle/total):0;previousCpu=next;mbps=(bytes-previousBytes)*8/5/1e6;previousBytes=bytes;},5000).unref();
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
async function upload(req,res,url){
 const file=url.searchParams.get('path'), hash=req.headers['x-content-sha256'], size=Number(req.headers['content-length']);
 if(!safePath(file)||!(/^[a-f0-9]{64}$/).test(hash||'')||!Number.isSafeInteger(size)||size<=0||size>10*1024**3)return json(res,400,{error:'Invalid metadata'});
 if(activeUploads.has(file)||activeUploads.size>=2)return json(res,429,{error:'Transfer busy'});
 activeUploads.add(file);
 const target=path.join(ROOT,file),tmp=target+'.'+crypto.randomUUID()+'.partial';
 try{
  await fsp.mkdir(path.dirname(target),{recursive:true,mode:0o700});
  if(!(await fsp.realpath(path.dirname(target))).startsWith(await fsp.realpath(ROOT)+path.sep))throw Error('Invalid directory');
  if(fs.existsSync(target))return json(res,await digest(resolveFile(ROOT,file))===hash?200:409,{sha256:await digest(resolveFile(ROOT,file)),size:fs.statSync(target).size});
  let count=0;const sum=crypto.createHash('sha256');
  const meter=new Transform({transform(chunk,enc,cb){count+=chunk.length;if(count>size)return cb(Error('Size exceeded'));sum.update(chunk);cb(null,chunk);}});
  await pipeline(req,meter,fs.createWriteStream(tmp,{flags:'wx',mode:0o600}));
  if(count!==size||sum.digest('hex')!==hash)throw Error('Checksum mismatch');
  await fsp.rename(tmp,target);json(res,201,{sha256:hash,size});
 }finally{activeUploads.delete(file);await fsp.rm(tmp,{force:true});}
}
async function serve(req,res,file){
 let target;try{target=resolveFile(ROOT,file);}catch{return json(res,404,{error:'Not found'});}
 const {size}=await fsp.stat(target);let start=0,end=size-1,status=200;
 if(req.headers.range){const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
  start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));end=m[1]&&m[2]?Math.min(end,Number(m[2])):end;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}status=206;
 }
 res.writeHead(status,{'Content-Type':{'.ts':'video/mp2t','.mp4':'video/mp4','.m3u8':'application/vnd.apple.mpegurl'}[path.extname(file)]||'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(status===206?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
 if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(target,{start,end});stream.on('data',b=>{bytes+=b.length;});await pipeline(stream,res);
}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://node');
 if(req.headers.origin===origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Range');res.setHeader('Access-Control-Expose-Headers','Content-Length,Content-Range');}
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET,HEAD,OPTIONS'});return res.end();}
 if(url.pathname.startsWith('/api/')){
  if(!equal(req.headers['x-api-key'],API_KEY))return json(res,401,{error:'Unauthorized'});
  if(url.pathname==='/api/health'&&req.method==='GET'){const d=await fsp.statfs(ROOT);return json(res,200,{cpu,mbps,ramUsed:os.totalmem()-os.freemem(),ramTotal:os.totalmem(),diskFree:d.bavail*d.bsize,uptime:os.uptime(),platform:process.platform});}
  if(url.pathname==='/api/upload'&&req.method==='PUT')return await upload(req,res,url);
  if(url.pathname==='/api/file'&&['GET','HEAD'].includes(req.method))return await serve(req,res,url.searchParams.get('path'));
  return json(res,404,{error:'Not found'});
 }
 if(!['GET','HEAD'].includes(req.method)||!url.pathname.startsWith('/media/'))return json(res,404,{error:'Not found'});
 const file=decodeURIComponent(url.pathname.slice(7));
 if(!/\.(ts|mp4)$/.test(file)||!verify(SIGNING_KEY,url.searchParams.get('token'),file))return json(res,403,{error:'Invalid media authorization'});
 await serve(req,res,file);
}catch(error){if(!res.headersSent)json(res,500,{error:'Media operation failed'});else res.destroy();console.error(JSON.stringify({event:'media-error',message:error.message}));}});
server.requestTimeout=7200000;server.headersTimeout=15000;
server.listen(Number(process.env.PORT||4000),process.env.BIND_HOST||'127.0.0.1');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();setTimeout(()=>process.exit(0),5000).unref();});
