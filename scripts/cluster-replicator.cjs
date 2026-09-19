const Database=require('better-sqlite3'),path=require('path');
require('@next/env').loadEnvConfig(process.cwd());
const {initializeCluster}=require('./cluster/schema.cjs'),{syncToMediaNodes}=require('./sync-media.js');
const db=new Database(path.join(process.cwd(),'data/anime.db'));initializeCluster(db);let stopping=false;
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{stopping=true;});
(async()=>{while(!stopping){
 if(db.prepare("SELECT value FROM site_settings WHERE key='cluster_enabled'").get()?.value==='1'){
  const folders=db.prepare("SELECT DISTINCT output_dir_name FROM transcode_jobs WHERE output_dir_name IS NOT NULL AND status IN ('processing','distributed','complete')").all();
  for(const row of folders){if(stopping)break;try{await syncToMediaNodes(null,row.output_dir_name);}catch(e){console.error(JSON.stringify({folder:row.output_dir_name,error:e.message}));}}
 }
 if(process.argv.includes('--once'))break;await new Promise(r=>setTimeout(r,15000));
}db.close();})().catch(e=>{console.error(e.message);process.exitCode=1;});
