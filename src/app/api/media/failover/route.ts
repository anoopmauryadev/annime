import {isSameOriginMutation} from '@/lib/auth';
import {clusterSession} from '@/lib/mediaCluster';
import {getDb} from '@/lib/db';
export async function POST(request:Request){
 if(!isSameOriginMutation(request))return new Response(null,{status:403});
 const session=clusterSession(request);if(!session||session.fresh)return new Response(null,{status:204});
 const db=getDb(),current=db.prepare('SELECT node_id FROM cluster_sessions WHERE id=? AND touched>?').get(session.id,Date.now()-45000) as {node_id:number}|undefined;
 if(current)db.prepare('INSERT INTO cluster_failures(session_id,node_id,until) VALUES(?,?,?) ON CONFLICT(session_id,node_id) DO UPDATE SET until=excluded.until').run(session.id,current.node_id,Date.now()+60000);
 return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
