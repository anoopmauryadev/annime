// Explicit manual backfill. Uploads made while transcoding is OFF stay untouched
// until this command is intentionally run.
const Database=require('better-sqlite3');
const path=require('path');
const fs=require('fs');
require('@next/env').loadEnvConfig(process.cwd());
const db=new Database(path.join(process.cwd(),'data','anime.db'));
db.pragma('busy_timeout = 5000');
const servers=db.prepare("SELECT * FROM servers WHERE stream_url LIKE '/uploads/videos/%'").all();
let count=0;
for(const server of servers) {
  if(db.prepare("SELECT id FROM transcode_jobs WHERE server_id=? AND status IN ('pending','processing','complete')").get(server.id)) continue;
  const input=path.join(process.cwd(),'public',server.stream_url);
  if(!fs.existsSync(input)) continue;
  const dir=`ep_${server.episode_id}_${server.id}_${Date.now()}`;
  db.prepare("INSERT INTO transcode_jobs(server_id,status,progress_text,input_path,output_dir_name,master_url) VALUES(?,'pending','Queued',?,?,?)")
    .run(server.id,input,dir,`/uploads/hls/${dir}/master.m3u8`);
  count++;
}
db.close();
console.log(`Queued ${count} uploads. Starting bounded worker.`);
process.argv.push('--once');
require('./transcode-worker.js');
