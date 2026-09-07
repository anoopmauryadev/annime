"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import BrandIntro, { BRAND_INTRO_DURATION } from "@/components/BrandIntro";

export default function BrandPreview() {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPlaying(false), BRAND_INTRO_DURATION);
    return () => window.clearTimeout(timer);
  }, [playing]);

  return (
    <main className="w-full max-w-5xl mx-auto px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between gap-4 mb-12">
        <Link href="/"><BrandLogo /></Link>
        <a href="/brand/anime-zone-logo.svg" download className="text-xs text-orange-400 underline underline-offset-4">Download logo</a>
      </header>
      <p className="text-xs uppercase tracking-[.3em] text-orange-400 mb-3">The Anime Zone identity</p>
      <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">A new world. Your language.</h1>
      <p className="text-sm text-gray-400 mb-8">Press play to preview your 2.8-second opening animation.</p>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10">
        <BrandIntro playing={playing} onPlay={() => setPlaying(true)} />
      </div>
      <p className="text-xs text-gray-500 mt-5">On episode pages, your video begins after the intro. This preview resets so you can play it again.</p>
    </main>
  );
}
