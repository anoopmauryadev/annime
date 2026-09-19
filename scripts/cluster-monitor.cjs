const Database=require('better-sqlite3'),path=require('path');
require('@next/env').loadEnvConfig(process.cwd());
const {initializeCluster}=require('./cluster/schema.cjs');
const db=new Database(path.join(process.cwd(),'data/anime.db'));initializeCluster(db);
let stopping=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;});
async function tick(){
 const enabled=db.prepare("SELECT value FROM site_settings WHERE key='cluster_transcoding_enabled'").get()?.value==='1';
 db.prepare("UPDATE cluster_jobs SET state=CASE WHEN attempt<3 THEN 'pending' ELSE 'failed' END,error='Worker lease expired' WHERE state='running' AND expires<?").run(Date.now());
 if(!enabled){
  db.transaction(()=>{for(const parent of db.prepare("SELECT id FROM transcode_jobs WHERE status='distributed'").all()){
   if(db.prepare("SELECT id FROM cluster_jobs WHERE parent_id=? AND state='running'").get(parent.id))continue;
   db.prepare("UPDATE cluster_jobs SET state='cancelled',expires=0 WHERE parent_id=? AND state='pending'").run(parent.id);
   db.prepare("UPDATE transcode_jobs SET status='pending',progress_text='Returned to local worker' WHERE id=?").run(parent.id);
  }}).immediate();
 }
 if(enabled){
  db.transaction(()=>{
   for(const job of db.prepare("SELECT id FROM transcode_jobs WHERE status='pending' AND input_path IS NOT NULL AND output_dir_name IS NOT NULL").all()){
    db.prepare("UPDATE transcode_jobs SET status='distributed',progress_text='Queued on media workers' WHERE id=? AND status='pending'").run(job.id);
    db.prepare("UPDATE cluster_jobs SET state='pending',attempt=0,error='' WHERE parent_id=? AND state IN ('failed','cancelled')").run(job.id);
    for(const q of ['360p','480p','original'])db.prepare('INSERT OR IGNORE INTO cluster_jobs(parent_id,quality) VALUES(?,?)').run(job.id,q);
   }
   db.prepare("UPDATE cluster_jobs SET state=CASE WHEN attempt<3 THEN 'pending' ELSE 'failed' END,error='Worker lease expired' WHERE state='running' AND expires<?").run(Date.now());
   for(const parent of db.prepare("SELECT id,output_dir_name FROM transcode_jobs WHERE status='distributed'").all()){
    const jobs=db.prepare('SELECT quality,state FROM cluster_jobs WHERE parent_id=?').all(parent.id);
    db.prepare("UPDATE transcode_jobs SET progress_text=?,updated_at=datetime('now') WHERE id=?").run(jobs.map(j=>j.quality+': '+j.state).join(' · '),parent.id);
    if(jobs.length&&jobs.every(j=>['complete','skipped'].includes(j.state)))db.prepare("UPDATE transcode_jobs SET status='complete',progress_text='Distributed conversion complete',updated_at=datetime('now') WHERE id=?").run(parent.id);
    else if(jobs.some(j=>j.state==='failed')&&jobs.every(j=>['complete','skipped','failed'].includes(j.state)))db.prepare("UPDATE transcode_jobs SET status='failed',error='Remote rendition failed; inspect Media Servers',updated_at=datetime('now') WHERE id=?").run(parent.id);
   }
  }).immediate();
 }
 await Promise.allSettled(db.prepare('SELECT * FROM cluster_nodes').all().map(async node=>{
  try{
   const response=await fetch(new URL('/api/health',node.url),{headers:{'x-api-key':node.api_key},redirect:'error',signal:AbortSignal.timeout(4000)});
   if(!response.ok)throw Error(`Health status ${response.status}`);
   const metrics=await response.json();
   if(!['cpu','mbps','diskFree'].every(k=>Number.isFinite(metrics[k])&&metrics[k]>=0))throw Error('Invalid health metrics');
   db.prepare("UPDATE cluster_nodes SET last_seen=?,metrics=?,error='' WHERE id=?").run(Date.now(),JSON.stringify(metrics),node.id);
  }catch(error){db.prepare('UPDATE cluster_nodes SET error=? WHERE id=?').run(error.message.slice(0,160),node.id);}
 }));
 db.prepare('DELETE FROM cluster_sessions WHERE touched<?').run(Date.now()-120000);
 db.prepare('DELETE FROM cluster_failures WHERE until<?').run(Date.now());
}
(async()=>{while(!stopping){await tick();if(process.argv.includes('--once'))break;await new Promise(r=>setTimeout(r,5000));}db.close();})().catch(e=>{console.error(e.message);process.exitCode=1;});
