"use client";

import BrandLogo from "./BrandLogo";
import { useEffect, useRef, useState } from "react";

export const BRAND_INTRO_DURATION = 2800;

export default function BrandIntro({ playing, onPlay, mediaUrl, onComplete }: { playing: boolean; onPlay: () => void; mediaUrl?: string; onComplete?: () => void }) {
  if (playing && mediaUrl) return <CustomVideoIntro key={mediaUrl} url={mediaUrl} onComplete={onComplete} />;
  return (
    <div className={`az-intro ${playing ? "az-intro-playing" : "az-intro-idle"}`}>
      <div className="az-intro-halo" aria-hidden="true" />
      <div className="az-intro-streak" aria-hidden="true" />
      <div className="az-intro-lockup">
        <BrandLogo className="az-brand-cinema" />
        <p className="az-intro-tagline">A NEW WORLD. YOUR LANGUAGE.</p>
      </div>
      {playing ? (
        <span className="sr-only" role="status">Hindi Anime Zone intro. Your video starts next.</span>
      ) : (
        <button type="button" className="az-intro-play" onClick={onPlay}>
          <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d="m1 1 10 6-10 6Z" fill="currentColor" /></svg>
          Play episode
        </button>
      )}
      <span className="az-intro-caption" aria-hidden="true">{playing ? "HINDI ANIME ZONE PRESENTS" : "YOUR NEXT WORLD AWAITS"}</span>
    </div>
  );
}

function CustomVideoIntro({ url, onComplete }: { url: string; onComplete?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    video.current?.play().catch(() => { if (active) setNeedsPlay(true); });
    return () => { active = false; };
  }, []);

  return (
    <div className="absolute inset-0 z-20 bg-black" data-custom-intro>
      <video ref={video} src={url} playsInline preload="auto" aria-label="Anime Zone intro"
        className="absolute inset-0 w-full h-full object-contain"
        onPlay={() => setNeedsPlay(false)} onEnded={onComplete} onError={() => setFailed(true)} />
      {failed ? (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-white text-sm">
          <p>Intro could not load.</p>
          <button className="az-intro-play" onClick={onComplete}>Continue to episode</button>
        </div>
      ) : needsPlay && (
        <button className="absolute inset-0 flex items-center justify-center bg-black/60 text-white font-bold"
          onClick={() => video.current?.play().catch(() => setNeedsPlay(true))}>Tap to play intro</button>
      )}
    </div>
  );
}
