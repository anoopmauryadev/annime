import BrandLogo from "./BrandLogo";
import Link from "next/link";
import { Send, Shield } from "lucide-react";

export default function Footer() {
  const genresList = [
    "Action",
    "Adventure",
    "Comedy",
    "Drama",
    "Fantasy",
    "Shounen",
    "Romance",
    "Sci-Fi",
    "Supernatural",
    "Sports",
  ];

  return (
    <footer className="bg-[#0b0c10] mt-auto pt-10 pb-8">
      <div className="container mx-auto px-4 md:px-6">
        {/* Top Footer Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-white/[0.05]">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-3">
            <Link href="/" className="inline-flex items-center gap-1 group">
              <BrandLogo />
            </Link>
            
            <p className="text-xs text-gray-400 leading-relaxed max-w-md">
              Anime Zone is the ultimate platform to stream your favorite anime series and movies online in Hindi, Tamil, Telugu, English, and Japanese multi-audio in High Definition.
            </p>

            <div className="pt-2">
              <a
                href="https://t.me/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#ff640a] hover:bg-[#e05300] text-white text-xs font-bold px-4 py-2 rounded transition-all"
              >
                <Send size={14} /> Join Telegram Community
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Navigation</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li><Link href="/" className="hover:text-[#ff640a] transition-colors">Home</Link></li>
              <li><Link href="/series" className="hover:text-[#ff640a] transition-colors">Anime Series</Link></li>
              <li><Link href="/movies" className="hover:text-[#ff640a] transition-colors">Anime Movies</Link></li>
              <li><Link href="/category/anime" className="hover:text-[#ff640a] transition-colors">Popular Anime</Link></li>
              <li><Link href="/category/cartoon" className="hover:text-[#ff640a] transition-colors">Cartoons & Kids</Link></li>
            </ul>
          </div>

          {/* Genres */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Popular Genres</h4>
            <div className="flex flex-wrap gap-1.5">
              {genresList.map((g) => (
                <Link
                  key={g}
                  href={`/category/${g.toLowerCase()}`}
                  className="text-[11px] bg-[#141519] hover:bg-[#ff640a] text-gray-400 hover:text-white px-2.5 py-1 rounded transition-all"
                >
                  {g}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Disclaimer & Copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs text-gray-500">
          <p>© 2026 Anime Zone. Non-commercial anime streaming.</p>
        </div>
      </div>
    </footer>
  );
}
