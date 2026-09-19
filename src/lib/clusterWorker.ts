import {getDb} from './db';
import {equal} from '../../scripts/cluster/protocol.cjs';
import fs from 'fs';
import path from 'path';
export interface WorkerNode{id:number;api_key:string;enabled:number;transcode_enabled:number;cpu_quota:number;max_mbps:number;metrics:string;last_seen:number;paused:number;profiles:string}
export interface ClusterJob{id:number;parent_id:number;quality:string;node_id:number;lease:string;state:string;expires:number;input_path:string;output_dir_name:string;server_id:number}
export function workerNode(request:Request):WorkerNode|null{
 const id=Number(request.headers.get('x-node-id'));if(!Number.isSafeInteger(id)||id<=0)return null;
 const node=getDb().prepare('SELECT * FROM cluster_nodes WHERE id=?').get(id) as WorkerNode|undefined;
 return node&&equal(request.headers.get('x-api-key'),node.api_key)?node:null;
}
export function leasedJob(node:WorkerNode,id:number,lease:string):ClusterJob|null{
 if(!Number.isSafeInteger(id)||typeof lease!=='string')return null;
 return getDb().prepare(`SELECT j.*,p.input_path,p.output_dir_name,p.server_id FROM cluster_jobs j JOIN transcode_jobs p ON p.id=j.parent_id
 WHERE j.id=? AND j.node_id=? AND j.lease=? AND j.state='running' AND j.expires>? AND p.status='distributed'`).get(id,node.id,lease,Date.now()) as ClusterJob|undefined || null;
}
export function sourceFile(job:ClusterJob){
 const root=fs.realpathSync(path.join(process.cwd(),'public/uploads/videos')),file=fs.realpathSync(job.input_path);
 if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile())throw Error('Invalid source');return file;
}
export function staging(job:ClusterJob){return path.join(process.cwd(),'data/cluster-staging',String(job.id),job.lease);}
export function artifactName(name:string,quality:string){return quality==='original'?name==='original.mp4':name===quality+'.m3u8'||new RegExp('^'+quality+'_\\d+\\.ts$').test(name);}
