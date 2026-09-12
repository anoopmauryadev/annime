import { getDb, getTranscodeJobByServer } from "@/lib/db";
import fs from 'fs';
import path from 'path';
import {spawn} from 'child_process';
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const serverId = parseInt(searchParams.get("server_id") || "0");

  if (!serverId) {
    return NextResponse.json({ error: "server_id required" }, { status: 400 });
  }

  const job = getTranscodeJobByServer(serverId);

  if (!job) {
    return NextResponse.json({ status: "none", progress_text: "" });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status, // "pending" | "processing" | "complete" | "failed"
    progress_text: job.progress_text,
    error: job.error || "",
    actual_height: job.actual_height,
    video_codec: job.video_codec,
    audio_codec: job.audio_codec,
    quality_warning: job.quality_warning || '',
    updated_at: job.updated_at,
  });
}

export async function POST(request: Request) {
  const auth=requireAdminAuth(request);
  if(!auth.authorized)return NextResponse.json({error:auth.error},{status:401});
  const body=await request.json();
  const id=Number(body.server_id);
  if(!Number.isSafeInteger(id)||id<=0)return NextResponse.json({error:'Invalid server ID'},{status:400});
  const job=getTranscodeJobByServer(id);
  if(!job || job.status!=='failed')return NextResponse.json({error:'Only failed jobs can be retried.'},{status:409});
  try {
    const root=fs.realpathSync(path.join(process.cwd(),'public/uploads/videos'));
    const source=fs.realpathSync(job.input_path);
    if(!source.startsWith(root+path.sep)||!fs.statSync(source).isFile()||!/^[a-zA-Z0-9_-]+$/.test(job.output_dir_name))throw Error();
  }catch{return NextResponse.json({error:'Original file missing or invalid. Restore the correct source before retrying.'},{status:409});}
  const result=getDb().prepare("UPDATE transcode_jobs SET status='pending',attempts=0,error='',progress_text='Retry queued; checking actual resolution',updated_at=datetime('now') WHERE id=? AND status='failed'").run(job.id);
  if(!result.changes)return NextResponse.json({error:'Job already changed; refresh status.'},{status:409});
  if(process.env.TRANSCODE_WORKER_MODE!=='external') {
    const worker=spawn(process.execPath,[path.join(process.cwd(),'scripts/transcode-worker.js'),'--once'],{stdio:'ignore',detached:true});
    worker.on('error',error=>console.error('Worker launch failed',error));worker.unref();
  }
  return NextResponse.json({status:'pending'});
}
