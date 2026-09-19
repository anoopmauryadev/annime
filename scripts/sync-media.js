const fs=require('fs'), path=require('path');
const Database=require('better-sqlite3');
const {initializeCluster}=require('./cluster/schema.cjs');
const {digest,resolveFile}=require('./cluster/protocol.cjs');
const {limitedFile}=require('./cluster/transfer.cjs');
async function syncToMediaNodes(episodeId,outputDirName){
 if(!/^[a-zA-Z0-9_-]+$/.test(outputDirName))throw Error('Invalid output directory');
 const db=new Database(path.join(process.cwd(),'data/anime.db'));initializeCluster(db);
 try{
  if(db.prepare("SELECT value FROM site_settings WHERE key='cluster_enabled'").get()?.value!=='1')return;
  const nodes=db.prepare('SELECT * FROM cluster_nodes WHERE enabled=1 AND draining=0 AND last_seen>?').all(Date.now()-20000);
  const root=path.join(process.cwd(),'public/uploads'), dir=path.join(root,'hls',outputDirName);
  // Only immutable, fully published rendition files. Playlists stay on main VPS.
  const files=new Set();
  for(const name of fs.readdirSync(dir).filter(n=>/^\d+p\.m3u8$/.test(n))){
   const text=fs.readFileSync(path.join(dir,name),'utf8');if(!text.includes('#EXT-X-ENDLIST'))continue;
   const segments=text.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
   if(segments.every(s=>/^[a-zA-Z0-9_-]+\.ts$/.test(s)&&fs.existsSync(path.join(dir,s))))segments.forEach(s=>files.add(s));
  }
  if(fs.existsSync(path.join(dir,'original.mp4')))files.add('original.mp4');
  for(const node of nodes)for(const name of files){
   const relative=`hls/${outputDirName}/${name}`, file=resolveFile(root,relative);
   const stat=fs.statSync(file),size=stat.size;
   const existing=db.prepare('SELECT sha256,size,mtime_ms FROM cluster_files WHERE node_id=? AND path=?').get(node.id,relative);
   if(existing?.size===size&&existing.mtime_ms===stat.mtimeMs)continue;
   const sha256=await digest(file);
   if(existing?.sha256===sha256){db.prepare('UPDATE cluster_files SET mtime_ms=? WHERE node_id=? AND path=?').run(stat.mtimeMs,node.id,relative);continue;}
   const url=new URL('/api/upload',node.url);url.searchParams.set('path',relative);
   db.prepare('DELETE FROM cluster_files WHERE node_id=? AND path=?').run(node.id,relative);
   const response=await fetch(url,{method:'PUT',headers:{'x-api-key':node.api_key,'x-content-sha256':sha256,'Content-Type':'application/octet-stream','Content-Length':String(size)},body:limitedFile(file),duplex:'half',redirect:'error',signal:AbortSignal.timeout(3600000)});
   if(!response.ok)throw Error(`Replica transfer failed: node ${node.id}, status ${response.status}`);
   const result=await response.json();if(result.sha256!==sha256||result.size!==size)throw Error('Replica verification failed');
   db.prepare('INSERT INTO cluster_files(node_id,path,sha256,size,mtime_ms) VALUES(?,?,?,?,?) ON CONFLICT(node_id,path) DO UPDATE SET sha256=excluded.sha256,size=excluded.size,mtime_ms=excluded.mtime_ms').run(node.id,relative,sha256,size,stat.mtimeMs);
  }
 }finally{db.close();}
}
module.exports={syncToMediaNodes};
