// Preview by default. Explicit --apply queues missing low renditions; never deletes media.
const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');
const Database=require('better-sqlite3');
const root=process.cwd(),apply=process.argv.includes('--apply');
if(apply) {
  try {
    const pid=Number(fs.readFileSync(path.join(root,'data/transcode-worker.lock'),'utf8'));
    if(!Number.isSafeInteger(pid)||pid<=0)throw Error('Invalid worker lock. Inspect it before repair.');
    try {process.kill(pid,0);throw Error('Stop annime-transcoder before applying repairs.');}
    catch(error){if(error.code!=='ESRCH')throw error;}
  } catch(error){if(error.code!=='ENOENT')throw error;}
}
const db=new Database(path.join(root,'data/anime.db'),{fileMustExist:true});
db.pragma('busy_timeout = 5000');
const localUrl=value=>{
  if(!value)return '';
  if(value.startsWith('/uploads/'))return value;
  try{return new URL(value).pathname;}catch{return '';}
};
const videoRoot=path.join(root,'public/uploads/videos'),hlsRoot=path.join(root,'public/uploads/hls');
function sourceFile(value) {
  if(!value)return null;
  const candidate=value.startsWith('/uploads/') ? path.join(root,'public',value) : value;
  try {
    const file=fs.realpathSync(candidate),base=fs.realpathSync(videoRoot);
    return file.startsWith(base+path.sep)&&fs.statSync(file).isFile()?file:null;
  }catch{return null;}
}
function ready(folder,quality) {
  try {
    const text=fs.readFileSync(path.join(hlsRoot,folder,quality+'p.m3u8'),'utf8');
    const segments=text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#'));
    return text.startsWith('#EXTM3U')&&text.includes('#EXT-X-ENDLIST')&&segments.length>0&&segments.every(name=>
      /^[a-zA-Z0-9_-]+\.ts$/.test(name)&&fs.statSync(path.join(hlsRoot,folder,name)).size>0);
  }catch{return false;}
}
let queued=0,healthy=0,skipped=0;
try {
  for(const server of db.prepare('SELECT * FROM servers ORDER BY id').all()) {
    const url=localUrl(server.stream_url);
    if(!/^\/uploads\/(videos|hls)\//.test(url))continue;
    const job=db.prepare('SELECT * FROM transcode_jobs WHERE server_id=? ORDER BY id DESC LIMIT 1').get(server.id);
    let input=sourceFile(job?.input_path)||sourceFile(url);
    if(!input) {
      const candidates=[...new Set(db.prepare('SELECT download_url FROM downloads WHERE episode_id=?').all(server.episode_id).map(row=>sourceFile(localUrl(row.download_url))).filter(Boolean))];
      if(candidates.length===1)input=candidates[0];
    }
    if(!input){console.log(`SKIP server ${server.id}: original missing or ambiguous; needs manual source mapping.`);skipped++;continue;}
    let height;
    try {height=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=height','-of','json',input],{timeout:30000,maxBuffer:1024*1024})).streams[0]?.height;}
    catch {console.log(`SKIP server ${server.id}: ffprobe could not read source.`);skipped++;continue;}
    const wanted=[360,480].filter(q=>q<=height);
    if(job?.source_quality && job.source_quality!==height){console.log(`SKIP server ${server.id}: selected ${job.source_quality}p does not match source ${height}p.`);skipped++;continue;}
    if(!wanted.length){console.log(`SKIP server ${server.id}: source below 360p.`);skipped++;continue;}
    const folder=(url.startsWith('/uploads/hls/')?url.split('/')[3]:job?.output_dir_name)||`ep_${server.episode_id}_${server.id}_repair`;
    if(!/^[a-zA-Z0-9_-]+$/.test(folder)){console.log(`SKIP server ${server.id}: invalid output folder.`);skipped++;continue;}
    const missing=wanted.filter(q=>!ready(folder,q));
    if(!missing.length){healthy++;continue;}
    console.log(`${apply?'QUEUE':'WOULD QUEUE'} server ${server.id}, episode ${server.episode_id}: missing ${missing.join('p, ')}p; previous status ${job?.status||'none'}`);
    if(apply) {
      if(job) db.prepare("UPDATE transcode_jobs SET status='pending',attempts=0,error='',progress_text='Manual repair: missing low qualities',input_path=?,output_dir_name=?,master_url=?,updated_at=datetime('now') WHERE id=?")
        .run(input,folder,`/uploads/hls/${folder}/master.m3u8`,job.id);
      else db.prepare("INSERT INTO transcode_jobs(server_id,episode_id,status,progress_text,input_path,output_dir_name,master_url) VALUES(?,?,'pending','Manual backfill',?,?,?)")
        .run(server.id,server.episode_id,input,folder,`/uploads/hls/${folder}/master.m3u8`);
    }
    queued++;
  }
  console.log(JSON.stringify({mode:apply?'applied':'preview',queued,healthy,skipped}));
  console.log(apply?'Start the PM2 transcoder to process the queue.':'No changes made. Stop worker, back up DB, then use --apply to queue these repairs.');
}finally{db.close();}
