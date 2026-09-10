'use client';
import { useEffect } from 'react';
export default function SitePresence() {
  useEffect(()=>{
    let cancelled=false;
    const ping=()=>{if(!cancelled && document.visibilityState==='visible')fetch('/api/analytics/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visible:true})}).catch(()=>{});};
    // Establish the shared HttpOnly browser identity before sending presence.
    fetch('/api/keys/status').then(ping).catch(()=>{});
    const timer=setInterval(ping,15000);document.addEventListener('visibilitychange',ping);
    return ()=>{cancelled=true;clearInterval(timer);document.removeEventListener('visibilitychange',ping);};
  },[]);
  return null;
}
