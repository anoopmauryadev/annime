'use client';
import {useEffect,useState} from 'react';
import {adminFetch} from '@/lib/adminApi';

type Status={uploadTarget:'vps'|'s3';engine:'vps'|'mediaconvert';playbackSource:'vps'|'cloud';syncEnabled:boolean;deleteLocal:boolean;
  storageReady:boolean;cloudFrontReady:boolean;mediaConvertReady:boolean;bucket:string;region:string;cdn:string;
  objects:{folders:number;videos:number};jobs:{awsActive:number;awaitingSync:number}};

export default function AdminCloudSettings() {
  const [status,setStatus]=useState<Status|null>(null),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
  const load=()=>adminFetch('/api/admin/cloud-status').then(async res=>{if(!res.ok)throw Error();setStatus(await res.json());})
    .catch(()=>setMessage('Could not load AWS settings. Reload to retry.'));
  useEffect(()=>{load();},[]);
  const save=async(patch:Record<string,string>)=>{
    setSaving(true);setMessage('');
    try {const res=await adminFetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});
      const data=await res.json();if(!res.ok)throw Error(data.error || 'Could not save');await load();setMessage('AWS settings saved.');
    } catch(error) {setMessage(error instanceof Error?error.message:'Could not save');}finally{setSaving(false);}
  };
  const ready=!!status&&!saving;
  const choice=(label:string,field:string,current:string,options:{value:string;label:string;disabled?:boolean}[],description:string)=>
    <div className="py-4 border-b border-slate-800 last:border-0" key={field}>
      <div className="flex justify-between items-center gap-4 flex-wrap"><span className="font-medium">{label}</span>
        <div role="radiogroup" aria-label={label} className="flex rounded-lg overflow-hidden border border-slate-700">
          {options.map(option=><button key={option.value} type="button" role="radio" aria-checked={current===option.value}
            disabled={!ready||option.disabled} onClick={()=>current!==option.value&&save({[field]:option.value})}
            className={`px-3 py-2 text-sm font-bold disabled:opacity-40 ${current===option.value?'bg-violet-600':'bg-slate-800 hover:bg-slate-700'}`}>{option.label}</button>)}
        </div></div>
      <p className="text-sm text-slate-400 mt-2">{description}</p></div>;
  const toggle=(label:string,field:string,on:boolean,disabled:boolean,description:string)=>
    <div className="py-4 border-b border-slate-800 last:border-0" key={field}>
      <div className="flex justify-between items-center gap-4"><span className="font-medium">{label}</span>
        <button type="button" role="switch" aria-label={label} aria-checked={on} disabled={!ready||disabled} onClick={()=>save({[field]:on?'0':'1'})}
          className={`px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 ${on?'bg-violet-600':'bg-slate-700'}`}>{on?'ON':'OFF'}</button></div>
      <p className="text-sm text-slate-400 mt-2">{description}</p></div>;
  const badge=(label:string,ok:boolean,detail:string)=><div className={`rounded-lg border px-3 py-2 text-sm ${ok?'border-emerald-500/40 text-emerald-300':'border-slate-700 text-slate-400'}`}>
    <span className="font-bold">{ok?'✓':'✗'} {label}</span><span className="block text-xs mt-0.5 break-all">{detail}</span></div>;

  return <section className="p-6 bg-[#1a1a2e] border border-slate-800 rounded-2xl"><h2 className="text-lg font-bold">AWS storage &amp; CDN</h2>
    <p className="text-sm text-slate-400 mt-2">Choose where new videos are uploaded, transcoded and served from. VIP, key and login checks always run on this server; AWS only receives short-lived signed links.</p>
    {status&&<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
      {badge('S3 bucket',status.storageReady,status.storageReady?`${status.bucket} (${status.region})`:'Set AWS_REGION, AWS_S3_BUCKET')}
      {badge('CloudFront',status.cloudFrontReady,status.cloudFrontReady?status.cdn:'Optional: CLOUDFRONT_* (else S3 signed links)')}
      {badge('MediaConvert',status.mediaConvertReady,status.mediaConvertReady?'Ready':'Set MEDIACONVERT_ROLE_ARN')}
    </div>}
    {status&&<p className="text-xs text-slate-500 mt-2">On AWS: {status.objects.folders} HLS folders, {status.objects.videos} videos · AWS jobs running: {status.jobs.awsActive} · Waiting for S3 sync: {status.jobs.awaitingSync}</p>}
    {status&&<>
      {choice('Upload destination','upload_target',status.uploadTarget,[{value:'vps',label:'VPS'},{value:'s3',label:'AWS S3',disabled:!status.storageReady}],
        'AWS S3: the admin browser uploads straight to the bucket, so large files do not use VPS bandwidth or disk. VPS: the current resumable upload to this server.')}
      {choice('Transcoding engine','transcode_engine',status.engine,[{value:'vps',label:'VPS (FFmpeg)'},{value:'mediaconvert',label:'AWS MediaConvert',disabled:!status.mediaConvertReady}],
        'Upload one high-quality file. AWS MediaConvert makes 360p, 480p, 720p/1080p (when the source is that large) and Original on AWS without using VPS CPU; it is billed per output minute. VPS uses FFmpeg on this server. Auto-transcoding ON/OFF below still applies.')}
      {choice('Playback source','playback_source',status.playbackSource,[{value:'vps',label:'VPS first'},{value:'cloud',label:'AWS first',disabled:!status.storageReady}],
        'AWS first: videos stored on S3 play through CloudFront (or signed S3 links), so viewers do not use VPS bandwidth. Either way, a video that exists in only one place plays from there.')}
      {toggle('Copy VPS transcodes to S3','cloud_sync_enabled',status.syncEnabled,!status.storageReady,
        'After FFmpeg finishes on the VPS, upload the HLS folder and source video to S3. Needs the cloud worker running (pm2 annime-cloud). Older videos: run npm run cloud:migrate once.')}
      {toggle('Delete VPS copy after S3 upload','cloud_delete_local',status.deleteLocal,!status.storageReady,
        'Frees VPS disk once a video is safely on S3. Skipped while the media-node cluster is enabled. Deleted local files cannot be restored from this panel.')}
    </>}
    {message&&<p role="status" className="mt-3 text-sm text-violet-300">{message}</p>}
  </section>;
}
