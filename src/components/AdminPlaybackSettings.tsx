'use client';
import {useEffect,useState} from 'react';
import {adminFetch} from '@/lib/adminApi';
type Mode='login'|'all'|'preview';
export default function AdminPlaybackSettings() {
  const [mode,setMode]=useState<Mode>('login'),[free480,setFree480]=useState(true),[original,setOriginal]=useState(true),[freeOriginal,setFreeOriginal]=useState(false);
  const [ready,setReady]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
  const accept=(data:Record<string,string>)=>{
    setMode((data.playback_guest_mode || (data.playback_login_required==='0'?'all':'login')) as Mode);
    setFree480(data.free_480p_enabled!=='0');setOriginal(data.vip_original_enabled!=='0');setFreeOriginal(data.free_original_enabled==='1');
  };
  useEffect(()=>{adminFetch('/api/admin/settings').then(async res=>{if(!res.ok)throw Error();accept(await res.json());setReady(true);}).catch(()=>setMessage('Could not load playback settings. Reload to retry.'));},[]);
  const save=async(patch:Record<string,string>)=>{
    setSaving(true);setMessage('');
    try {const res=await adminFetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});
      const data=await res.json();if(!res.ok)throw Error(data.error || 'Could not save');accept(data.settings);setMessage('Playback settings saved.');
    } catch(error) {setMessage(error instanceof Error?error.message:'Could not save');}finally{setSaving(false);}
  };
  const toggle=(label:string,on:boolean,disabled:boolean,click:()=>void,description:string)=><div className="py-4 border-b border-slate-800 last:border-0" key={label}>
    <div className="flex justify-between items-center gap-4"><span className="font-medium">{label}</span><button type="button" role="switch" aria-label={label} aria-checked={on} disabled={!ready||saving||disabled} onClick={click} className={`px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 ${on?'bg-violet-600':'bg-slate-700'}`}>{on?'ON':'OFF'}</button></div>
    <p className="text-sm text-slate-400 mt-2">{description}</p></div>;
  return <section className="p-6 bg-[#1a1a2e] border border-slate-800 rounded-2xl"><h2 className="text-lg font-bold">Playback access</h2>
    <p className="text-sm text-slate-400 mt-2">Key verification stays in effect when enabled. VIP always requires login.</p>
    {toggle('All episodes without login',mode==='all',mode==='preview',()=>save({playback_guest_mode:mode==='all'?'login':'all'}),'Allows guests to watch all episodes. Turn off the two-episode option before enabling this.')}
    {toggle('First 2 episodes without login',mode==='preview',mode==='all',()=>save({playback_guest_mode:mode==='preview'?'login':'preview'}),'Guests can watch the first two episodes of each anime across all seasons; subsequent episodes require login. Turn off all-episodes guest access first.')}
    <p className="mt-3 text-sm text-amber-300">Both guest switches OFF = login required for every episode.</p>
    {toggle('480p for free users',free480,false,()=>save({free_480p_enabled:free480?'0':'1'}),'OFF leaves free users with 360p. VIP members can still select prepared 480p.')}
    {toggle('Original Quality for VIP',original,false,()=>save({vip_original_enabled:original?'0':'1'}),'Controls Original playback availability. It does not delete files or change the separate VIP download feature.')}
    {toggle('Original Quality for free users',freeOriginal,false,()=>save({free_original_enabled:freeOriginal?'0':'1'}),'Allows non-VIP users to play the uploaded 720p/1080p Original file. Keep OFF to require VIP.')}
    {message&&<p role="status" className="mt-3 text-sm text-violet-300">{message}</p>}
  </section>;
}
