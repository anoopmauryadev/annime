"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type Hls from "hls.js";
import Link from "next/link";
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize, Settings, SkipForward, Loader2, PictureInPicture2, X } from "lucide-react";

type NativeAudioTrack = { label: string; language: string; enabled: boolean };
type PlayerVideo = HTMLVideoElement & { audioTracks?: ArrayLike<NativeAudioTrack>; webkitEnterFullscreen?: () => void };
type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  hlsRef: RefObject<Hls | null>;
  qualities: { index: number; name: string; locked?: boolean }[];
  quality: number;
  onQuality: (index: number) => void;
  onPlay: () => void;
  title?: string;
  nextEpisodeUrl?: string;
};
const time = (value: number) => {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export default function PlayerControls({ videoRef, containerRef, hlsRef, qualities, quality, onQuality, onPlay, title, nextEpisodeUrl }: Props) {
  const [media, setMedia] = useState({ paused: true, current: 0, duration: 0, buffered: 0, volume: 1, muted: false, rate: 1, waiting: false, error: false });
  const [visible, setVisible] = useState(true);
  const [menu, setMenu] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [notice, setNotice] = useState("");
  const [tracks, setTracks] = useState<{ audio: string[]; subtitles: string[]; audioIndex: number; subtitleIndex: number }>({ audio: [], subtitles: [], audioIndex: -1, subtitleIndex: -1 });
  const overlay = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const menuOpen = useRef(false);
  const touch = useRef({ at: 0, side: 0 });

  const wake = () => {
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!videoRef.current?.paused && !menuOpen.current && !overlay.current?.querySelector(":focus-visible")) setVisible(false);
    }, 3000);
  };

  useEffect(() => {
    const video = videoRef.current as PlayerVideo | null;
    if (!video) return;
    const update = () => {
      let buffered = 0;
      for (let i = 0; i < video.buffered.length; i++) if (video.buffered.start(i) <= video.currentTime) buffered = video.buffered.end(i);
      setMedia({ paused: video.paused, current: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : 0,
        buffered, volume: video.volume, muted: video.muted, rate: video.playbackRate, waiting: !video.paused && video.readyState < 3, error: !!video.error });
      const hls = hlsRef.current;
      const nativeAudio = Array.from(video.audioTracks || []);
      const nativeText = Array.from(video.textTracks).filter(t => t.kind === "subtitles" || t.kind === "captions");
      setTracks({
        audio: hls?.audioTracks.length ? hls.audioTracks.map((t, i) => t.name || t.lang || `Audio ${i + 1}`) : nativeAudio.map((t, i) => t.label || t.language || `Audio ${i + 1}`),
        subtitles: hls?.subtitleTracks.length ? hls.subtitleTracks.map((t, i) => t.name || t.lang || `Subtitles ${i + 1}`) : nativeText.map((t, i) => t.label || t.language || `Subtitles ${i + 1}`),
        audioIndex: hls?.audioTracks.length ? hls.audioTrack : nativeAudio.findIndex(t => t.enabled),
        subtitleIndex: hls?.subtitleTracks.length ? hls.subtitleTrack : nativeText.findIndex(t => t.mode === "showing"),
      });
    };
    const onPlayback = () => { update(); wake(); };
    const events = ["timeupdate", "durationchange", "loadedmetadata", "progress", "volumechange", "ratechange", "waiting", "playing", "error", "emptied"];
    events.forEach(event => video.addEventListener(event, update));
    video.addEventListener("pause", onPlayback);
    video.addEventListener("play", onPlayback);
    video.textTracks.addEventListener("change", update);
    const onFullscreen = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    setPip(!!document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function");
    update(); wake();
    return () => {
      events.forEach(event => video.removeEventListener(event, update));
      video.removeEventListener("pause", onPlayback); video.removeEventListener("play", onPlayback);
      video.textTracks.removeEventListener("change", update);
      document.removeEventListener("fullscreenchange", onFullscreen);
      clearTimeout(timer.current);
    };
    // The parent remounts controls for each stream; refs remain stable in between.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, containerRef, hlsRef]);

  const togglePlay = () => { if (videoRef.current?.paused) onPlay(); else videoRef.current?.pause(); wake(); };
  const seek = (offset: number) => {
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + offset));
    wake();
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen();
      else (videoRef.current as PlayerVideo)?.webkitEnterFullscreen?.();
    } catch { setNotice("Fullscreen is unavailable in this browser."); }
  };
  const selectTrack = (kind: "audio" | "subtitles", index: number) => {
    const video = videoRef.current as PlayerVideo;
    const hls = hlsRef.current;
    if (kind === "audio") {
      if (hls?.audioTracks.length) hls.audioTrack = index;
      else Array.from(video.audioTracks || []).forEach((track, i) => { track.enabled = i === index; });
    } else {
      if (hls?.subtitleTracks.length) hls.subtitleTrack = index;
      else Array.from(video.textTracks).filter(t => t.kind === "subtitles" || t.kind === "captions").forEach((track, i) => { track.mode = i === index ? "showing" : "disabled"; });
    }
    setTracks(previous => ({ ...previous, [kind === "audio" ? "audioIndex" : "subtitleIndex"]: index }));
  };
  const shown = visible || media.paused || menu || media.error;

  return (
    <div ref={overlay} className={`az-player-controls ${shown ? "is-visible" : ""}`} role="region" aria-label="Video player controls" tabIndex={0}
      onPointerMove={e => { if (e.pointerType === "mouse") wake(); }} onFocus={wake}
      onKeyDown={event => {
        if ((event.target as HTMLElement).closest("input,select,button,a")) return;
        if ([" ", "k", "ArrowLeft", "ArrowRight", "m", "f", "Escape"].includes(event.key)) event.preventDefault();
        if (event.key === " " || event.key === "k") togglePlay();
        if (event.key === "ArrowLeft") seek(-10);
        if (event.key === "ArrowRight") seek(10);
        if (event.key === "m" && videoRef.current) videoRef.current.muted = !videoRef.current.muted;
        if (event.key === "f") void toggleFullscreen();
        if (event.key === "Escape") { setMenu(false); menuOpen.current = false; }
      }}>
      <button className="az-player-surface" tabIndex={-1} aria-label="Show player controls" onClick={event => {
        if (event.detail === 0) wake();
      }} onPointerUp={event => {
        overlay.current?.focus({ preventScroll: true });
        const rect = event.currentTarget.getBoundingClientRect();
        const side = event.clientX - rect.left < rect.width / 3 ? -1 : event.clientX - rect.left > rect.width * 2 / 3 ? 1 : 0;
        if (event.pointerType === "touch") {
          if (side && touch.current.side === side && Date.now() - touch.current.at < 320) { seek(side * 10); touch.current.at = 0; }
          else { touch.current = { at: Date.now(), side }; if (visible && !media.paused) setVisible(false); else wake(); }
        } else togglePlay();
      }} />
      {media.waiting && <div className="az-player-loading" role="status" aria-label="Buffering"><Loader2 className="animate-spin" size={36} /></div>}
      {media.error && <div className="az-player-error" role="alert">Video could not load. Try another server or reload the page.</div>}
      <div className="az-player-chrome" aria-hidden={!shown} inert={!shown}>
        <div className="az-player-heading"><span>HINDI ANIME ZONE</span><strong>{title || "Now playing"}</strong></div>
        <div className="az-player-center">
          <button type="button" aria-label="Rewind 10 seconds" onClick={() => seek(-10)}><RotateCcw /><span>10</span></button>
          <button type="button" className="az-player-main-play" aria-label={media.paused ? "Play video" : "Pause video"} onClick={togglePlay}>{media.paused ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}</button>
          <button type="button" aria-label="Forward 10 seconds" onClick={() => seek(10)}><RotateCw /><span>10</span></button>
        </div>
        <div className="az-player-bottom">
          <input className="az-player-timeline" aria-label="Seek video" type="range" min={0} max={media.duration || 1} step={0.1} value={Math.min(media.current, media.duration || 0)} disabled={!media.duration}
            aria-valuetext={`${time(media.current)} of ${time(media.duration)}`}
            style={{ background: `linear-gradient(to right, #ff640a ${media.duration ? media.current / media.duration * 100 : 0}%, #ffffff55 0%, #ffffff55 ${media.duration ? media.buffered / media.duration * 100 : 0}%, #ffffff22 0%)` }}
            onInput={event => { if (videoRef.current) videoRef.current.currentTime = Number(event.currentTarget.value); wake(); }} />
          <div className="az-player-toolbar">
            <span className="az-player-time">{time(media.current)} <span>/ {time(media.duration)}</span></span>
            <button type="button" aria-label={media.muted || media.volume === 0 ? "Unmute" : "Mute"} onClick={() => { const video = videoRef.current!; video.muted = !video.muted; if (!video.volume) video.volume = 1; }}>{media.muted || !media.volume ? <VolumeX /> : <Volume2 />}</button>
            <input className="az-player-volume" aria-label="Volume" type="range" min={0} max={1} step={0.05} value={media.muted ? 0 : media.volume} onInput={event => { videoRef.current!.volume = Number(event.currentTarget.value); videoRef.current!.muted = false; }} />
            <div className="az-player-spacer" />
            {nextEpisodeUrl && <Link href={nextEpisodeUrl} aria-label="Next episode" title="Next episode"><SkipForward /></Link>}
            {pip && <button className="az-player-pip" type="button" aria-label="Picture in picture" onClick={async () => { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await videoRef.current?.requestPictureInPicture(); } catch { setNotice("Picture in picture is unavailable for this video."); } }}><PictureInPicture2 /></button>}
            <button type="button" aria-label="Playback settings" aria-expanded={menu} aria-controls="az-playback-settings" onClick={() => { menuOpen.current = !menu; setMenu(!menu); wake(); }}><Settings /></button>
            <button type="button" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize /> : <Maximize />}</button>
          </div>
        </div>
        {menu && <div className="az-player-settings" id="az-playback-settings" role="group" aria-label="Playback settings">
          <div><strong>Playback settings</strong><button type="button" aria-label="Close settings" onClick={() => { setMenu(false); menuOpen.current = false; wake(); }}><X size={18} /></button></div>
          <label>Speed<select aria-label="Playback speed" value={media.rate} onChange={e => { videoRef.current!.playbackRate = Number(e.target.value); }}>
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(speed => <option key={speed} value={speed}>{speed === 1 ? "Normal" : `${speed}×`}</option>)}
          </select></label>
          {qualities.length > 0 && <label>Quality<select aria-label="Video quality" value={quality} onChange={e => onQuality(Number(e.target.value))}><option value={-1}>Auto</option>{qualities.map(level => <option key={level.index} value={level.index} disabled={level.locked}>{level.name}</option>)}</select></label>}
          {tracks.audio.length > 1 && <label>Audio<select aria-label="Audio language" value={tracks.audioIndex} onChange={e => selectTrack("audio", Number(e.target.value))}>{tracks.audio.map((label, i) => <option key={i} value={i}>{label}</option>)}</select></label>}
          {tracks.subtitles.length > 0 && <label>Subtitles<select aria-label="Subtitles" value={tracks.subtitleIndex} onChange={e => selectTrack("subtitles", Number(e.target.value))}><option value={-1}>Off</option>{tracks.subtitles.map((label, i) => <option key={i} value={i}>{label}</option>)}</select></label>}
        </div>}
      </div>
      {notice && <button type="button" className="az-player-notice" onClick={() => setNotice("")}>{notice} ×</button>}
    </div>
  );
}
