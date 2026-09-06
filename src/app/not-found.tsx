import Link from "next/link";
import { Home, Search, TrendingUp } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center px-4 text-center">
      {/* Glowing 404 */}
      <div className="relative mb-8">
        <h1 className="text-[120px] sm:text-[180px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-[#ff640a] to-[#ff640a]/20 select-none">
          404
        </h1>
        <div className="absolute inset-0 blur-3xl bg-[#ff640a]/10 -z-10 rounded-full" />
      </div>

      {/* Anime character placeholder */}
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#ff640a]/30 to-purple-600/30 border-2 border-[#ff640a]/40 flex items-center justify-center mb-6 text-5xl">
        😶‍🌫️
      </div>

      <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
        Page Not Found!
      </h2>
      <p className="text-gray-400 text-sm sm:text-base max-w-md mb-8">
        Yeh page exist nahi karta. Shayad link galat hai ya page delete ho gaya.
        <br />
        <span className="text-[#ff640a]">Ghar wapas jao aur anime dekho! 🎌</span>
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="flex items-center gap-2 bg-[#ff640a] hover:bg-[#e05300] text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-[#ff640a]/30 hover:scale-105"
        >
          <Home size={16} /> Ghar Jao
        </Link>
        <Link
          href="/series"
          className="flex items-center gap-2 bg-[#141519] hover:bg-[#1e1e24] border border-white/10 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all"
        >
          <TrendingUp size={16} /> Series Dekho
        </Link>
        <Link
          href="/movies"
          className="flex items-center gap-2 bg-[#141519] hover:bg-[#1e1e24] border border-white/10 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all"
        >
          <Search size={16} /> Movies Dekho
        </Link>
      </div>

      {/* Decorative bottom text */}
      <p className="mt-12 text-xs text-gray-600">
        Error 404 — Kya hua? Nahi pata. 🤷
      </p>
    </div>
  );
}
