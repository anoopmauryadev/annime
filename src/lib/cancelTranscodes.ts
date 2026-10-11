import fs from 'fs';
import path from 'path';
import {getDb} from './db';

function cancelMediaConvert(id: string) {
  (async()=>{
    const {MediaConvertClient,CancelJobCommand}=await import('@aws-sdk/client-mediaconvert');
    await new MediaConvertClient({region:process.env.AWS_REGION}).send(new CancelJobCommand({Id:id}));
  })().catch(error=>console.error('[Cancel] MediaConvert cancel failed',id,error));
}

// Wait for the worker to close FFmpeg before a source/output is removed.
export async function cancelTranscodes(ids: number[]) {
  if (!ids.length) return;
  const db=getDb();
  const placeholders=ids.map(()=>'?').join(',');
  // Revoking leases blocks any later remote artifact publication.
  db.prepare(`UPDATE cluster_jobs SET state='cancelled',expires=0 WHERE parent_id IN (${placeholders}) AND state IN ('pending','running')`).run(...ids);
  db.prepare(`UPDATE transcode_jobs SET status='cancelled' WHERE id IN (${placeholders}) AND status='distributed'`).run(...ids);
  // AWS jobs have no local FFmpeg to wait for; stop the remote job and mark them cancelled now.
  const remote=db.prepare(`SELECT external_job_id FROM transcode_jobs WHERE id IN (${placeholders}) AND engine='mediaconvert' AND status='processing' AND external_job_id IS NOT NULL`).all(...ids) as {external_job_id:string}[];
  db.prepare(`UPDATE transcode_jobs SET status='cancelled' WHERE id IN (${placeholders}) AND engine='mediaconvert' AND status IN ('pending','processing','failed')`).run(...ids);
  for(const job of remote) cancelMediaConvert(job.external_job_id);
  db.prepare(`UPDATE transcode_jobs SET status=CASE WHEN status='processing' THEN 'cancelling' ELSE 'cancelled' END WHERE id IN (${placeholders}) AND status IN ('pending','processing','failed')`).run(...ids);
  for(let attempt=0;attempt<100;attempt++) {
    const waiting=db.prepare(`SELECT id FROM transcode_jobs WHERE id IN (${placeholders}) AND status='cancelling'`).all(...ids);
    if(!waiting.length)return;
    try {
      const pid=Number(fs.readFileSync(path.join(process.cwd(),'data/transcode-worker.lock'),'utf8'));
      if(!Number.isInteger(pid)||pid<=0)throw new Error('Invalid worker lock');
      process.kill(pid,0);
    } catch(error) {
      if(['ENOENT','ESRCH'].includes((error as NodeJS.ErrnoException).code || '')) {
        db.prepare(`UPDATE transcode_jobs SET status='cancelled' WHERE id IN (${placeholders}) AND status='cancelling'`).run(...ids);
        return;
      }
      throw error;
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Worker is still stopping this job. Retry deletion shortly; files were retained.');
}

export async function cancelServerTranscodes(serverId:number) {
  const jobs=getDb().prepare('SELECT id FROM transcode_jobs WHERE server_id=?').all(serverId) as {id:number}[];
  await cancelTranscodes(jobs.map(job=>job.id));
}
