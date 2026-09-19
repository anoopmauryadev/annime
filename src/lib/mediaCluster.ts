import crypto from 'crypto';
import {getDb} from './db';
import {sign} from '../../scripts/cluster/protocol.cjs';

interface NodeRow {id:number; url:string; signing_key:string; max_sessions:number; max_mbps:number; metrics:string; draining:number}
export function clusterSession(request:Request) {
  const value=request.headers.get('cookie')?.match(/(?:^|;\s*)media_session=([a-f0-9]{32})(?:;|$)/)?.[1];
  const key=process.env.ADMIN_SECRET_KEY;
  if(!key||key.length<32)return null;
  const cookie=value||crypto.randomBytes(16).toString('hex');
  return {id:crypto.createHmac('sha256',key).update(cookie).digest('hex'),cookie,fresh:!value};
}
export function remoteMedia(request:Request, file:string):Response|null {
  const db=getDb();
  const setting=db.prepare("SELECT value FROM site_settings WHERE key='cluster_enabled'").get() as {value:string}|undefined;
  if(setting?.value!=='1')return null;
  const now=Date.now();
  const identity=clusterSession(request);if(!identity)return null;
  const session=identity.id;
  const current=db.prepare('SELECT node_id FROM cluster_sessions WHERE id=? AND touched>?').get(session,now-45000) as {node_id:number}|undefined;
  const nodes=db.prepare(`SELECT n.* FROM cluster_nodes n JOIN cluster_files f ON f.node_id=n.id
    WHERE f.path=? AND n.enabled=1 AND n.last_seen>?`).all(file,now-20000) as NodeRow[];
  const candidates=nodes.flatMap(node=>{
    try {
      if(db.prepare('SELECT 1 FROM cluster_failures WHERE session_id=? AND node_id=? AND until>?').get(session,node.id,now))return [];
      const metrics=JSON.parse(node.metrics);
      const sessions=(db.prepare('SELECT COUNT(*) AS n FROM cluster_sessions WHERE node_id=? AND touched>?').get(node.id,now-45000) as {n:number}).n;
      const sticky=current?.node_id===node.id;
      if((node.draining&&!sticky)||(!sticky&&sessions>=node.max_sessions)||metrics.mbps>=node.max_mbps*0.9||metrics.diskFree<2*1024**3||metrics.cpu>95)return [];
      return [{node,score:(sticky?-10:0)+sessions/node.max_sessions+Number(metrics.mbps||0)/node.max_mbps}];
    }catch{return [];}
  }).sort((a,b)=>a.score-b.score);
  const selected=candidates[0]?.node;
  if(!selected)return null; // Local protected source remains the fallback.
  db.prepare('INSERT INTO cluster_sessions(id,node_id,touched) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET node_id=excluded.node_id,touched=excluded.touched').run(session,selected.id,now);
  const url=new URL('/media/'+file,selected.url);
  url.searchParams.set('token',sign(selected.signing_key,file));
  return new Response(null,{status:307,headers:{Location:url.toString(),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer',
    ...(identity.fresh?{'Set-Cookie':`media_session=${identity.cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${process.env.NODE_ENV==='production'?'; Secure':''}`}:{})}});
}
