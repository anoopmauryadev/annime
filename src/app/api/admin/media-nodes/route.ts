import {getDb} from '@/lib/db';
import {requireAdminAuth} from '@/lib/auth';
import crypto from 'crypto';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!requireAdminAuth(request).authorized)return Response.json({error:'Unauthorized'},{status:401});
 const db=getDb();
 const nodes=db.prepare(`SELECT id,name,url,enabled,draining,transcode_enabled,max_sessions,max_mbps,cpu_quota,paused,profiles,last_seen,metrics,error,
 (SELECT COUNT(*) FROM cluster_files f WHERE f.node_id=n.id) AS files,
 (SELECT COUNT(*) FROM cluster_sessions s WHERE s.node_id=n.id AND touched>?) AS sessions FROM cluster_nodes n`).all(Date.now()-45000);
 const enabled=(db.prepare("SELECT value FROM site_settings WHERE key='cluster_enabled'").get() as {value:string}|undefined)?.value==='1';
 const transcodeEnabled=(db.prepare("SELECT value FROM site_settings WHERE key='cluster_transcoding_enabled'").get() as {value:string}|undefined)?.value==='1';
 return Response.json({enabled,transcodeEnabled,nodes,jobs:db.prepare('SELECT id,parent_id,quality,state,node_id,attempt,error FROM cluster_jobs ORDER BY id DESC LIMIT 100').all(),audit:db.prepare('SELECT * FROM cluster_audit ORDER BY id DESC LIMIT 20').all()},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const auth=requireAdminAuth(request);if(!auth.authorized)return Response.json({error:'Unauthorized'},{status:401});
 const db=getDb();
 try{
  const body=await request.json();
  if(body.action==='toggle'||body.action==='toggle-transcode'){
   if(typeof body.enabled!=='boolean')throw Error('Invalid setting');
   db.prepare("INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(body.action==='toggle'?'cluster_enabled':'cluster_transcoding_enabled',body.enabled?'1':'0');
  }else if(body.action==='add'){
   const url=new URL(body.url);
   if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Use a dedicated HTTPS node origin');
   if(typeof body.name!=='string'||!body.name.trim()||body.name.length>80)throw Error('Invalid node name');
   const apiKey=crypto.randomBytes(32).toString('hex'),signingKey=crypto.randomBytes(32).toString('hex');
   const result=db.prepare('INSERT INTO cluster_nodes(name,url,api_key,signing_key) VALUES(?,?,?,?)').run(body.name.trim(),url.origin,apiKey,signingKey);
   db.prepare('INSERT INTO cluster_audit(action) VALUES(?)').run(`Admin ${auth.admin?.id}: added node ${result.lastInsertRowid}`);
   return Response.json({id:result.lastInsertRowid,apiKey,signingKey},{headers:{'Cache-Control':'no-store'}});
  }else if(body.action==='update'){
   if(!Number.isSafeInteger(body.id)||!['enabled','draining','transcode_enabled','paused'].every(k=>typeof body[k]==='boolean'))throw Error('Invalid controls');
   for(const [k,min,max] of [['max_sessions',1,1000],['max_mbps',1,10000],['cpu_quota',10,200]] as const)if(!Number.isInteger(body[k])||body[k]<min||body[k]>max)throw Error(`Invalid ${k}`);
   if(!Array.isArray(body.profiles)||!body.profiles.length||body.profiles.some((q:unknown)=>!['360p','480p','original'].includes(String(q))))throw Error('Invalid profiles');
   const result=db.prepare('UPDATE cluster_nodes SET enabled=?,draining=?,transcode_enabled=?,max_sessions=?,max_mbps=?,cpu_quota=?,paused=?,profiles=? WHERE id=?').run(Number(body.enabled),Number(body.draining),Number(body.transcode_enabled),body.max_sessions,body.max_mbps,body.cpu_quota,Number(body.paused),body.profiles.join(','),body.id);
   if(!result.changes)throw Error('Node not found');
  }else if(body.action==='retry'){
   if(!Number.isSafeInteger(body.id))throw Error('Invalid job');
   db.transaction(()=>{
    const job=db.prepare("SELECT parent_id FROM cluster_jobs WHERE id=? AND state='failed'").get(body.id) as {parent_id:number}|undefined;
    if(!job)throw Error('Only failed jobs can be retried');
    db.prepare("UPDATE cluster_jobs SET state='pending',attempt=0,error='' WHERE id=?").run(body.id);
    db.prepare("UPDATE transcode_jobs SET status='distributed',error='' WHERE id=? AND status='failed'").run(job.parent_id);
   }).immediate();
  }else throw Error('Unknown action');
  db.prepare('INSERT INTO cluster_audit(action) VALUES(?)').run(`Admin ${auth.admin?.id}: ${body.action} node ${body.id||'cluster'}`);
  return Response.json({ok:true});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Invalid request'},{status:400});}
}
