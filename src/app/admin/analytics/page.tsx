'use client';
import {useEffect,useState} from 'react';
import {adminFetch} from '@/lib/adminApi';
type Episode={id:number;title:string;anime_title:string;episode_number:number;season_number:number;plays:number;viewers:number;watch_seconds:number;average_seconds:number;average_progress:number;reached_end:number};
type Session={id:string;username:string|null;anime_title:string;episode_number:number;started_at:number;last_seen:number;position:number;duration:number;watch_seconds:number;state:string};
type Data={activeUsers:number;watchingUsers:number;generatedAt:number;episodes:Episode[];sessions:Session[];hourly:{hour:number;watch_seconds:number;viewers:number}[];retention:{second:number;viewers:number;watch_seconds:number}[]};
const time=(seconds:number)=>`${Math.floor(seconds/60)}m ${Math.round(seconds%60)}s`;
export default function AnalyticsPage() {
  const [days,setDays]=useState(7),[episode,setEpisode]=useState(0),[data,setData]=useState<Data|null>(null),[catalog,setCatalog]=useState<Episode[]>([]),[error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;
    const refresh=async()=>{
      try {const res=await adminFetch(`/api/admin/analytics?days=${days}${episode?`&episode_id=${episode}`:''}`);if(!res.ok)throw Error('Could not load analytics');
        const next=await res.json();if(cancelled)return;setData(next);setError('');if(!episode)setCatalog(next.episodes);
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Could not load');}
    };refresh();const timer=setInterval(refresh,15000);return()=>{cancelled=true;clearInterval(timer);};
  },[days,episode]);
  const watch=data?.episodes.reduce((sum,row)=>sum+row.watch_seconds,0)||0;
  const maxRetention=Math.max(1,...(data?.retention.map(row=>row.viewers)||[]));
  return <div className="space-y-6 max-w-7xl mx-auto">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">Video Analytics</h1><p className="text-sm text-slate-400">Refreshes every 15 seconds. Active means a heartbeat in the last 45 seconds.</p></div>
      <div className="flex flex-wrap gap-3"><select aria-label="Analytics period" className="bg-slate-800 rounded p-2" value={days} onChange={e=>{setDays(Number(e.target.value));setEpisode(0);}}>{[1,7,30,90].map(day=><option key={day} value={day}>Last {day} days</option>)}</select>
      <select aria-label="Analytics episode" className="bg-slate-800 rounded p-2 max-w-xs" value={episode} onChange={e=>setEpisode(Number(e.target.value))}><option value={0}>All watched episodes</option>{catalog.map(row=><option key={row.id} value={row.id}>{row.anime_title} · S{row.season_number} E{row.episode_number}</option>)}</select></div></div>
    {error&&<p role="alert" className="text-red-400">{error} {data?'Displayed data may be stale.':''}</p>}
    {!data&&!error&&<p>Loading analytics…</p>}
    {data&&<>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[['Active on site',data.activeUsers],['Watching now',data.watchingUsers],['Watch time (listed episodes)',time(watch)]].map(([label,value])=><div key={label} className="p-5 bg-[#1a1a2e] border border-slate-800 rounded-xl"><p className="text-slate-400 text-sm">{label}</p><p className="text-3xl mt-2 font-bold">{value}</p></div>)}</div>
      <p className="text-xs text-slate-400">Guests count by browser, signed-in viewers by account for live counts. Recording starts after this update; historical watch data cannot be reconstructed. Watch time excludes detected seeking and buffering. Counts are client-reported estimates, not billing records. Data retained for 90 days.</p>
      <section className="bg-[#1a1a2e] p-5 rounded-xl overflow-x-auto"><h2 className="font-bold mb-3">Most watched episodes</h2>
        <table className="w-full text-sm text-left"><thead className="text-slate-400"><tr>{['Episode','Viewers','Plays','Watch time','Avg. watch','Avg. furthest point','Reached 95%'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{data.episodes.map(row=><tr key={row.id} className="border-t border-slate-800"><td className="p-2"><button className="text-violet-300 text-left" onClick={()=>setEpisode(row.id)}>{row.anime_title} · S{row.season_number} E{row.episode_number}<span className="block text-xs text-slate-400">{row.title}</span></button></td><td className="p-2">{row.viewers}</td><td className="p-2">{row.plays}</td><td className="p-2">{time(row.watch_seconds)}</td><td className="p-2">{time(row.average_seconds)}</td><td className="p-2">{row.average_progress}%</td><td className="p-2">{row.reached_end}</td></tr>)}</tbody></table>
        {!data.episodes.length&&<p className="text-slate-400 mt-4">No recorded playback in this period yet.</p>}
        <p className="text-xs text-slate-500 mt-3">Up to 200 episodes, ranked by watch time. Reaching the end does not mean the viewer watched every earlier part.</p>
      </section>
      <section className="p-5 bg-[#1a1a2e] rounded-xl"><h2 className="font-bold mb-3">Where viewers watched · 30-second intervals</h2>
        {!episode?<p className="text-sm text-slate-400">Select an episode to see which parts attracted or lost viewers.</p>:<div className="max-h-80 overflow-y-auto space-y-2">{data.retention.map(row=><div key={row.second} className="flex items-center gap-3 text-xs"><span className="w-24 shrink-0">{time(row.second)}</span><div className="flex-1 h-4 bg-slate-800 rounded"><div className="h-4 bg-violet-500 rounded" style={{width:`${row.viewers/maxRetention*100}%`}} /></div><span className="w-24">{row.viewers} browsers</span></div>)}{!data.retention.length&&<p className="text-slate-400">Not enough playback data yet.</p>}</div>}
      </section>
      <section className="p-5 bg-[#1a1a2e] rounded-xl"><h2 className="font-bold mb-3">When people watched · hourly</h2><div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Time ({Intl.DateTimeFormat().resolvedOptions().timeZone})</th><th>Browsers</th><th>Watch time</th></tr></thead><tbody>{[...data.hourly].reverse().map(row=><tr key={row.hour} className="border-t border-slate-800"><td className="py-2">{new Date(row.hour*3600000).toLocaleString()}</td><td>{row.viewers}</td><td>{time(row.watch_seconds)}</td></tr>)}</tbody></table></div></section>
      <section className="p-5 bg-[#1a1a2e] rounded-xl overflow-x-auto"><h2 className="font-bold mb-3">Recent viewing sessions</h2><table className="w-full text-left text-sm"><thead><tr>{['Viewer','Episode','Started','Last seen','Position / duration','Watched','State'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{data.sessions.map(row=><tr key={row.id} className="border-t border-slate-800"><td className="p-2">{row.username||'Guest'}</td><td className="p-2">{row.anime_title} · E{row.episode_number}</td><td className="p-2 whitespace-nowrap">{new Date(row.started_at).toLocaleString()}</td><td className="p-2 whitespace-nowrap">{new Date(row.last_seen).toLocaleString()}</td><td className="p-2 whitespace-nowrap">{time(row.position)} / {time(row.duration)}</td><td className="p-2">{time(row.watch_seconds)}</td><td className="p-2">{data.generatedAt-row.last_seen>45000?'Inactive':row.state}</td></tr>)}</tbody></table></section>
      <p className="text-xs text-slate-500">Updated {new Date(data.generatedAt).toLocaleTimeString()}. External iframe players are not included in detailed playback tracking.</p>
    </>}
  </div>;
}
