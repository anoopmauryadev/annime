'use client';
import { useEffect,useRef,type RefObject } from 'react';
export default function PlaybackAnalytics({videoRef,episodeId,enabled,source}:{videoRef:RefObject<HTMLVideoElement|null>;episodeId?:number;enabled:boolean;source:string}) {
  const session=useRef('');
  const sessionEpisode=useRef<number|undefined>(undefined);
  useEffect(()=>{
    const video=videoRef.current;
    if(!video || !episodeId || !enabled)return;
    if(!session.current || sessionEpisode.current!==episodeId) {
      session.current=crypto.randomUUID();sessionEpisode.current=episodeId;
    }
    const session_id=session.current;
    let state='paused',pending=false;
    const send=(next:string,unloading=false)=>{
      state=next;
      if(!Number.isFinite(video.duration) || video.duration<=0)return;
      const body=JSON.stringify({session_id,episode_id:episodeId,position:video.currentTime,duration:video.duration,state,visible:document.visibilityState==='visible'});
      if(unloading) {navigator.sendBeacon('/api/analytics/heartbeat',new Blob([body],{type:'application/json'}));return;}
      if(pending)return;
      pending=true;
      fetch('/api/analytics/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body}).catch(()=>{}).finally(()=>{pending=false;});
    };
    const playing=()=>send('playing'),paused=()=>send('paused'),waiting=()=>send('buffering'),seeking=()=>send('seeking'),ended=()=>send('ended');
    const leave=()=>send('paused',true);
    video.addEventListener('playing',playing);video.addEventListener('pause',paused);video.addEventListener('waiting',waiting);
    video.addEventListener('seeking',seeking);video.addEventListener('ended',ended);window.addEventListener('pagehide',leave);
    if(!video.paused)playing();
    const timer=setInterval(()=>send(video.paused?'paused':state==='seeking' && !video.seeking?'playing':state),10000);
    return ()=>{
      leave();clearInterval(timer);video.removeEventListener('playing',playing);video.removeEventListener('pause',paused);
      video.removeEventListener('waiting',waiting);video.removeEventListener('seeking',seeking);video.removeEventListener('ended',ended);window.removeEventListener('pagehide',leave);
    };
  },[episodeId,enabled,source,videoRef]);
  return null;
}
