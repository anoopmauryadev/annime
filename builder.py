import os
import textwrap

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n')
    print(f"Created {path}")

# 1. globals.css
write_file('src/app/globals.css', """
@import "tailwindcss";

:root {
  --background: #0f0f1a;
  --foreground: #e2e8f0;
}

body {
  background: #0f0f1a;
  color: #e2e8f0;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #1a1a2e; }
::-webkit-scrollbar-thumb { background: #7c3aed; border-radius: 3px; }

/* Hide scrollbar for carousel containers */
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
""")

# 2. layout.tsx
write_file('src/app/layout.tsx', """
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SearchModal from "@/components/SearchModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Anime World India",
  description: "Watch the latest Hindi, Tamil, and Telugu dubbed anime and cartoons.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col bg-[#0f0f1a] text-white`}>
        <Header />
        <main className="flex-1 w-full pb-10">
          {children}
        </main>
        <Footer />
        <SearchModal />
      </body>
    </html>
  );
}
""")

# 3. Header.tsx
write_file('src/components/Header.tsx', """
"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, Menu, X, Send } from "lucide-react";
import { usePathname } from "next/navigation";

export default function Header() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const pathname = usePathname();
  
  const navLinks = [
    { name: "HOME", href: "/" },
    { name: "Movies", href: "/movies" },
    { name: "Series", href: "/series" },
    { name: "Anime", href: "/category/anime" },
    { name: "Cartoon", href: "/category/cartoon" },
  ];

  const openSearch = () => {
    window.dispatchEvent(new CustomEvent("open-search-modal"));
  };

  return (
    <>
      <div className="bg-violet-600 text-white text-xs sm:text-sm py-1.5 px-4 text-center flex items-center justify-center gap-2 font-medium">
        <Send size={14} />
        Join our Telegram Group - Stay updated!
        <a href="#" className="underline font-bold ml-1 hover:text-violet-200">Join Now</a>
      </div>
      
      <header className="sticky top-0 z-40 bg-[#1a1a2e]/95 backdrop-blur-sm border-b border-white/5">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl md:text-2xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
              Anime World
            </Link>
            
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              {navLinks.map(link => {
                const active = pathname === link.href || pathname.startsWith(link.href + '/');
                return (
                  <Link 
                    key={link.name} 
                    href={link.href}
                    className={`px-3 py-2 rounded-md transition-colors ${active ? 'text-violet-400 bg-white/5' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={openSearch} className="p-2 text-gray-300 hover:text-white transition-colors rounded-full hover:bg-white/5" aria-label="Search">
              <Search size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <button className="px-4 py-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors">Login</button>
              <button className="px-4 py-1.5 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-md transition-colors">Signup</button>
            </div>
            <button onClick={() => setMobileMenu(true)} className="md:hidden p-2 text-gray-300 hover:text-white">
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenu && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenu(false)} />
          <div className="relative w-64 max-w-sm bg-[#1a1a2e] h-full flex flex-col p-4 animate-in slide-in-from-left">
            <div className="flex items-center justify-between mb-8">
              <span className="font-bold text-lg bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">Menu</span>
              <button onClick={() => setMobileMenu(false)} className="p-2 text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              {navLinks.map(link => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenu(false)}
                  className="px-4 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 font-medium"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2">
              <button className="w-full py-2.5 font-medium bg-white/5 text-white rounded-lg">Login</button>
              <button className="w-full py-2.5 font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg">Signup</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
""")

# 4. Footer.tsx
write_file('src/components/Footer.tsx', """
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#16213e] py-8 border-t border-white/5 mt-auto">
      <div className="container mx-auto px-4 flex flex-col items-center gap-6">
        <Link href="/" className="text-2xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
          Anime World
        </Link>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-gray-400">
          <Link href="/" className="hover:text-violet-400 transition-colors">HOME</Link>
          <Link href="/movies" className="hover:text-violet-400 transition-colors">Movies</Link>
          <Link href="/series" className="hover:text-violet-400 transition-colors">Series</Link>
          <Link href="/category/anime" className="hover:text-violet-400 transition-colors">Anime</Link>
          <Link href="/category/cartoon" className="hover:text-violet-400 transition-colors">Cartoon</Link>
        </div>
        <div className="text-center text-xs text-gray-500 flex flex-col gap-2">
          <p>© 2025 Anime World India. All Rights Reserved.</p>
          <p><Link href="/dmca" className="hover:text-white underline">DMCA Disclaimer</Link></p>
        </div>
      </div>
    </footer>
  );
}
""")

# 5. SearchModal.tsx
write_file('src/components/SearchModal.tsx', """
"use client";
import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onOpen = () => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); };
    window.addEventListener("open-search-modal", onOpen);
    return () => window.removeEventListener("open-search-modal", onOpen);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/anime?search=${encodeURIComponent(query)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.data || []);
        }
      } catch (err) {}
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0f0f1a]/95 backdrop-blur-md p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between mb-8">
        <div className="flex-1 relative flex items-center">
          <Search className="absolute left-4 text-gray-400" size={24} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search anime, series, movies..."
            className="w-full bg-[#1a1a2e] text-white text-lg sm:text-2xl rounded-full py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xl"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-4 p-1 text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>
        <button onClick={() => setIsOpen(false)} className="ml-4 sm:ml-8 p-3 bg-white/5 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors">
          <X size={28} />
        </button>
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto hide-scrollbar">
        {loading && <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-violet-500" size={32} /></div>}
        
        {!loading && query && results.length === 0 && (
          <div className="text-center text-gray-400 mt-10 text-lg">No results found for "{query}"</div>
        )}

        {!loading && results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-20">
            {results.map(anime => (
              <div 
                key={anime.id} 
                onClick={() => { setIsOpen(false); router.push(`/anime/${anime.slug}`); }}
                className="cursor-pointer group relative rounded-xl overflow-hidden bg-[#1a1a2e] transition-transform hover:scale-105"
              >
                <div className="aspect-[2/3] relative">
                  <img src={anime.poster || "/placeholder.jpg"} alt={anime.title} className="w-full h-full object-cover group-hover:brightness-110 transition-all" />
                  <div className="absolute top-2 right-2 bg-black/70 text-xs font-bold px-2 py-0.5 rounded text-white backdrop-blur-sm">
                    {anime.type === 'movie' ? 'Movie' : 'Series'}
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-sm text-white line-clamp-1 group-hover:text-violet-400 transition-colors">{anime.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">{anime.year || "N/A"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
""")

# 6. HeroSpotlight.tsx
write_file('src/components/HeroSpotlight.tsx', """
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Info, ChevronLeft, ChevronRight } from "lucide-react";

export default function HeroSpotlight() {
  const [spotlights, setSpotlights] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    fetch('/api/anime/spotlight').then(r => r.json()).then(d => setSpotlights(d.data || []));
  }, []);

  useEffect(() => {
    if (spotlights.length <= 1) return;
    const t = setInterval(() => setCurrent(c => (c + 1) % spotlights.length), 5000);
    return () => clearInterval(t);
  }, [spotlights.length]);

  if (!spotlights.length) return <div className="h-[50vh] md:h-[70vh] bg-[#16213e] animate-pulse"></div>;

  const anime = spotlights[current];
  
  const parseJsonStr = (str: string) => { try { return JSON.parse(str); } catch { return []; } };
  const languages = parseJsonStr(anime.languages || "[]");

  return (
    <div className="relative w-full h-[50vh] md:h-[70vh] bg-black overflow-hidden group">
      <img src={anime.backdrop || anime.poster} alt={anime.title} className="absolute inset-0 w-full h-full object-cover opacity-60 md:opacity-70 transition-transform duration-1000 scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] via-[#0f0f1a]/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f1a] via-[#0f0f1a]/70 to-transparent md:w-3/4" />
      
      <div className="absolute inset-0 container mx-auto px-4 flex flex-col justify-end md:justify-center pb-12 md:pb-0 z-10">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-4 line-clamp-2 md:line-clamp-none drop-shadow-lg">{anime.title}</h1>
          
          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs md:text-sm font-semibold">
            <span className="bg-white text-black px-2 py-0.5 rounded shadow-sm">{anime.quality || "HD"}</span>
            <span className="bg-violet-600/80 text-white px-2 py-0.5 rounded backdrop-blur-sm uppercase">{anime.type}</span>
            {languages.slice(0,3).map((lang: string, i: number) => (
              <span key={i} className="bg-[#1a1a2e]/80 border border-white/20 text-gray-300 px-2 py-0.5 rounded backdrop-blur-sm">{lang}</span>
            ))}
          </div>

          <p className="text-gray-300 text-sm md:text-base mb-8 line-clamp-3 md:line-clamp-4 max-w-xl text-shadow-sm">{anime.synopsis || "No synopsis available."}</p>
          
          <div className="flex items-center gap-4">
            <Link href={`/anime/${anime.slug}`} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 px-6 md:px-8 rounded-full transition-all hover:scale-105 shadow-lg shadow-violet-600/30">
              <Play fill="currentColor" size={20} /> Watch Now
            </Link>
            <Link href={`/anime/${anime.slug}`} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-full backdrop-blur-sm transition-all hover:scale-105">
              <Info size={20} /> Details
            </Link>
          </div>
        </div>
      </div>

      {spotlights.length > 1 && (
        <>
          <button onClick={() => setCurrent(c => (c - 1 + spotlights.length) % spotlights.length)} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-violet-600 text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-20 hidden md:block">
            <ChevronLeft size={32} />
          </button>
          <button onClick={() => setCurrent(c => (c + 1) % spotlights.length)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-violet-600 text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-20 hidden md:block">
            <ChevronRight size={32} />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {spotlights.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-all ${i === current ? 'bg-violet-500 w-6 md:w-8' : 'bg-white/30 hover:bg-white/50'}`} aria-label={`Go to slide ${i + 1}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
""")


# 7. AnimeCard.tsx
write_file('src/components/AnimeCard.tsx', """
import Link from "next/link";
import { Play } from "lucide-react";

export default function AnimeCard({ anime }: { anime: any }) {
  const parseJsonStr = (str: string) => { try { return JSON.parse(str); } catch { return []; } };
  const languages = parseJsonStr(anime.languages || "[]");
  
  const getLangColor = (lang: string) => {
    const l = lang.toLowerCase();
    if (l.includes('hindi')) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (l.includes('english')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (l.includes('jap')) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (l.includes('tamil')) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    if (l.includes('telugu')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <div className="group flex flex-col gap-2 w-full">
      <Link href={`/anime/${anime.slug}`} className="relative rounded-xl overflow-hidden aspect-[2/3] bg-[#1a1a2e] block shadow-lg">
        <img src={anime.poster || "/placeholder.jpg"} alt={anime.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 group-hover:brightness-75" />
        
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {anime.quality && (
            <span className="bg-white text-black text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm">{anime.quality}</span>
          )}
        </div>
        
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          <span className="bg-violet-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm capitalize backdrop-blur-sm">{anime.type}</span>
          {anime.year && <span className="bg-black/70 text-gray-200 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm">{anime.year}</span>}
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-violet-600/80 p-3 rounded-full text-white backdrop-blur-sm transform scale-50 group-hover:scale-100 transition-transform duration-300">
            <Play fill="currentColor" size={24} className="ml-1" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-wrap gap-1">
          {languages.map((lang: string, idx: number) => (
            <span key={idx} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getLangColor(lang)} backdrop-blur-sm`}>{lang}</span>
          ))}
        </div>
      </Link>
      <Link href={`/anime/${anime.slug}`} className="font-bold text-white text-sm line-clamp-2 hover:text-violet-400 transition-colors leading-tight">
        {anime.title}
      </Link>
    </div>
  );
}
""")

# 8. AnimeSection.tsx
write_file('src/components/AnimeSection.tsx', """
import Link from "next/link";
import AnimeCard from "./AnimeCard";

export default function AnimeSection({ title, animeList, viewMoreLink }: { title: string, animeList: any[], viewMoreLink?: string }) {
  if (!animeList || animeList.length === 0) return null;

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
            <span className="w-1.5 h-6 bg-violet-600 rounded-full"></span>
            {title}
          </h2>
          {viewMoreLink && (
            <Link href={viewMoreLink} className="text-sm font-semibold text-gray-400 hover:text-violet-400 transition-colors flex items-center gap-1">
              View More <span className="text-violet-500">&gt;</span>
            </Link>
          )}
        </div>
        
        <div className="flex overflow-x-auto gap-3 md:gap-4 lg:gap-5 pb-4 hide-scrollbar snap-x">
          {animeList.map(anime => (
            <div key={anime.id} className="w-[42vw] sm:w-[30vw] md:w-[22vw] lg:w-[15vw] shrink-0 snap-start">
              <AnimeCard anime={anime} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
""")

# 9. AlphabetFilter.tsx
write_file('src/components/AlphabetFilter.tsx', """
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AlphabetFilter() {
  const letters = ["#", "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];
  const pathname = usePathname();
  
  return (
    <div className="py-4 md:py-6 bg-[#16213e] border-y border-white/5 my-8">
      <div className="container mx-auto px-4">
        <h3 className="text-sm text-gray-400 mb-3 font-semibold text-center md:text-left">A-Z List</h3>
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 md:gap-2">
          {letters.map(letter => {
            const letterVal = letter === "#" ? "0-9" : letter;
            const href = `/letter/${letterVal}`;
            const isActive = pathname === href;
            
            return (
              <Link 
                key={letter} 
                href={href}
                className={`w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded text-xs md:text-sm font-bold transition-colors
                  ${isActive ? 'bg-violet-600 text-white' : 'bg-[#1a1a2e] text-gray-300 hover:bg-violet-600/50 hover:text-white'}`}
              >
                {letter}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
""")

# 10. page.tsx
write_file('src/app/page.tsx', """
import { getAllAnime } from "@/lib/db";
import HeroSpotlight from "@/components/HeroSpotlight";
import AnimeSection from "@/components/AnimeSection";
import AlphabetFilter from "@/components/AlphabetFilter";

export const revalidate = 60; // Revalidate every minute

export default function Home() {
  const latestSeries = getAllAnime({ type: 'series', sort: 'latest', limit: 12 });
  const latestMovies = getAllAnime({ type: 'movie', sort: 'latest', limit: 12 });
  const popular = getAllAnime({ sort: 'views', limit: 12 });
  const topRated = getAllAnime({ sort: 'rating', limit: 12 });

  return (
    <div className="flex flex-col gap-2">
      <HeroSpotlight />
      
      <div className="pt-6">
        <AnimeSection title="Latest Series" animeList={latestSeries} viewMoreLink="/series" />
        <AnimeSection title="Latest Movies" animeList={latestMovies} viewMoreLink="/movies" />
        <AlphabetFilter />
        <AnimeSection title="Most Popular" animeList={popular} />
        <AnimeSection title="Top Rated" animeList={topRated} />
      </div>
    </div>
  );
}
""")

# 11. series/page.tsx
write_file('src/app/series/page.tsx', """
import { getAllAnime, getTotalAnimeCount } from "@/lib/db";
import AnimeCard from "@/components/AnimeCard";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default async function SeriesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const animeList = getAllAnime({ type: 'series', sort: 'latest', limit, offset });
  const total = getTotalAnimeCount({ type: 'series' });
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
        <h1 className="text-3xl font-black text-white">All Series</h1>
        <span className="bg-white/10 text-gray-300 px-2 py-1 rounded text-sm font-bold">{total} Results</span>
      </div>

      {animeList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {animeList.map(anime => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">No series found.</div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-12">
          {page > 1 && (
            <Link href={`/series?page=${page - 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
              <ChevronLeft size={20} />
            </Link>
          )}
          
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const p = page > 3 && totalPages > 5 ? page - 2 + i : i + 1;
              if (p > totalPages) return null;
              return (
                <Link 
                  key={p} 
                  href={`/series?page=${p}`}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold transition-colors ${page === p ? 'bg-violet-600 text-white' : 'bg-[#1a1a2e] text-gray-400 hover:bg-white/10 hover:text-white'}`}
                >
                  {p}
                </Link>
              );
            })}
          </div>

          {page < totalPages && (
            <Link href={`/series?page=${page + 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
              <ChevronRight size={20} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
""")


# 12. movies/page.tsx
write_file('src/app/movies/page.tsx', """
import { getAllAnime, getTotalAnimeCount } from "@/lib/db";
import AnimeCard from "@/components/AnimeCard";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default async function MoviesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const animeList = getAllAnime({ type: 'movie', sort: 'latest', limit, offset });
  const total = getTotalAnimeCount({ type: 'movie' });
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
        <h1 className="text-3xl font-black text-white">All Movies</h1>
        <span className="bg-white/10 text-gray-300 px-2 py-1 rounded text-sm font-bold">{total} Results</span>
      </div>

      {animeList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {animeList.map(anime => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">No movies found.</div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-12">
          {page > 1 && (
            <Link href={`/movies?page=${page - 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
              <ChevronLeft size={20} />
            </Link>
          )}
          
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const p = page > 3 && totalPages > 5 ? page - 2 + i : i + 1;
              if (p > totalPages) return null;
              return (
                <Link 
                  key={p} 
                  href={`/movies?page=${p}`}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold transition-colors ${page === p ? 'bg-violet-600 text-white' : 'bg-[#1a1a2e] text-gray-400 hover:bg-white/10 hover:text-white'}`}
                >
                  {p}
                </Link>
              );
            })}
          </div>

          {page < totalPages && (
            <Link href={`/movies?page=${page + 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
              <ChevronRight size={20} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
""")

# 13. category/[type]/page.tsx
write_file('src/app/category/[type]/page.tsx', """
import { getAllAnime, getTotalAnimeCount } from "@/lib/db";
import AnimeCard from "@/components/AnimeCard";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

export default async function CategoryPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const type = resolvedParams.type;
  if (!type) notFound();

  const page = parseInt(resolvedSearchParams.page || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  // Assuming genre mapping or category mapping
  const isGenre = ['action', 'comedy', 'drama', 'horror', 'romance'].includes(type.toLowerCase());
  
  const queryOpts: any = { sort: 'latest', limit, offset };
  if (isGenre) {
    queryOpts.genre = type;
  } else if (type === 'anime' || type === 'cartoon') {
    // For now filtering by genre as "anime" or "cartoon"
    queryOpts.genre = type;
  }

  const animeList = getAllAnime(queryOpts);
  const total = getTotalAnimeCount(queryOpts);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
        <h1 className="text-3xl font-black text-white capitalize">{type}</h1>
        <span className="bg-white/10 text-gray-300 px-2 py-1 rounded text-sm font-bold">{total} Results</span>
      </div>

      {animeList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {animeList.map(anime => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">No items found for this category.</div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-12">
          {page > 1 && (
            <Link href={`/category/${type}?page=${page - 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
              <ChevronLeft size={20} />
            </Link>
          )}
          {page < totalPages && (
            <Link href={`/category/${type}?page=${page + 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
              <ChevronRight size={20} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
""")

# 14. letter/[letter]/page.tsx
write_file('src/app/letter/[letter]/page.tsx', """
import { getAllAnime, getTotalAnimeCount } from "@/lib/db";
import AnimeCard from "@/components/AnimeCard";
import Link from "next/link";
import AlphabetFilter from "@/components/AlphabetFilter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

export default async function LetterPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ letter: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const letter = resolvedParams.letter;
  if (!letter) notFound();

  const page = parseInt(resolvedSearchParams.page || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const queryOpts = { letter: letter === '0-9' ? '0-9' : letter, sort: 'latest', limit, offset };
  const animeList = getAllAnime(queryOpts);
  const total = getTotalAnimeCount(queryOpts);
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <AlphabetFilter />
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
          <h1 className="text-3xl font-black text-white">Letter: {letter.toUpperCase()}</h1>
          <span className="bg-white/10 text-gray-300 px-2 py-1 rounded text-sm font-bold">{total} Results</span>
        </div>

        {animeList.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {animeList.map(anime => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">No items found starting with '{letter}'.</div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-12">
            {page > 1 && (
              <Link href={`/letter/${letter}?page=${page - 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
                <ChevronLeft size={20} />
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/letter/${letter}?page=${page + 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
                <ChevronRight size={20} />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
""")


# 15. anime/[slug]/page.tsx
write_file('src/app/anime/[slug]/page.tsx', """
import { getAnimeBySlug, getSeasonsByAnime, getEpisodesByAnime } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Play, Star, Clock, Calendar } from "lucide-react";

export default async function AnimePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const anime = getAnimeBySlug(resolvedParams.slug);
  
  if (!anime) notFound();

  const seasons = getSeasonsByAnime(anime.id);
  const episodes = getEpisodesByAnime(anime.id);

  const parseJsonStr = (str: string) => { try { return JSON.parse(str); } catch { return []; } };
  const languages = parseJsonStr(anime.languages || "[]");
  const genres = parseJsonStr(anime.genres || "[]");

  const firstEpisode = episodes.length > 0 ? episodes[0] : null;
  const firstSeason = seasons.length > 0 ? seasons[0] : null;

  return (
    <div className="min-h-screen pb-20">
      {/* Backdrop Header */}
      <div className="relative w-full h-[50vh] md:h-[60vh] bg-[#0f0f1a]">
        <img src={anime.backdrop || anime.poster} alt={anime.title} className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] via-[#0f0f1a]/80 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0">
          <div className="container mx-auto px-4 flex flex-col md:flex-row gap-6 md:gap-10 pb-10 translate-y-20 md:translate-y-1/4">
            
            <div className="w-40 md:w-64 shrink-0 mx-auto md:mx-0 -mt-20 md:mt-0 rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 aspect-[2/3] bg-[#1a1a2e]">
              <img src={anime.poster} alt={anime.title} className="w-full h-full object-cover" />
            </div>

            <div className="flex-1 text-center md:text-left flex flex-col justify-end pt-4 md:pt-0">
              <h1 className="text-3xl md:text-5xl font-black text-white mb-2">{anime.title}</h1>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4 text-sm font-semibold mb-4">
                <span className="flex items-center gap-1 text-yellow-500 bg-black/40 px-2 py-1 rounded backdrop-blur-md">
                  <Star fill="currentColor" size={16} /> {anime.rating || "N/A"}
                </span>
                <span className="flex items-center gap-1 text-gray-300">
                  <Calendar size={16} /> {anime.year}
                </span>
                <span className="bg-violet-600 px-2 py-1 rounded text-white capitalize">{anime.type}</span>
                <span className="border border-white/20 px-2 py-1 rounded text-gray-300 uppercase">{anime.status}</span>
                <span className="bg-white text-black px-2 py-1 rounded">{anime.quality || "HD"}</span>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-6">
                {genres.map((g: string, i: number) => (
                  <span key={i} className="text-xs border border-white/10 bg-white/5 text-gray-300 px-3 py-1 rounded-full">{g}</span>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-8">
                <span className="text-sm text-gray-400 mr-2">Audio:</span>
                {languages.map((l: string, i: number) => (
                  <span key={i} className="text-xs bg-white/10 text-white px-3 py-1 rounded">{l}</span>
                ))}
              </div>

              {firstEpisode && firstSeason && (
                <Link 
                  href={`/watch/${anime.slug}/${firstSeason.season_number}x${firstEpisode.episode_number}`}
                  className="inline-flex items-center justify-center md:justify-start gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 px-8 rounded-full transition-all hover:scale-105 shadow-lg shadow-violet-600/30 self-center md:self-start"
                >
                  <Play fill="currentColor" size={20} /> Play S{firstSeason.season_number}-E{firstEpisode.episode_number}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 mt-32 md:mt-40">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
          
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-violet-600 rounded-full"></span> Synopsis
            </h2>
            <p className="text-gray-300 leading-relaxed text-sm md:text-base">
              {anime.synopsis || "No synopsis available."}
            </p>

            {seasons.length > 0 && (
              <div className="mt-12">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-violet-600 rounded-full"></span> Episodes
                </h2>
                
                {seasons.map(season => {
                  const seasonEpisodes = episodes.filter(e => e.season_id === season.id);
                  if (seasonEpisodes.length === 0) return null;
                  
                  return (
                    <div key={season.id} className="mb-8">
                      <h3 className="text-lg font-bold text-gray-300 mb-4 px-4 py-2 bg-[#1a1a2e] rounded-lg border-l-4 border-violet-600">
                        {season.title || `Season ${season.season_number}`}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {seasonEpisodes.map(ep => (
                          <Link 
                            key={ep.id}
                            href={`/watch/${anime.slug}/${season.season_number}x${ep.episode_number}`}
                            className="group block bg-[#1a1a2e] rounded-xl overflow-hidden hover:bg-[#16213e] transition-colors border border-white/5 hover:border-violet-500/50"
                          >
                            <div className="aspect-video relative bg-black overflow-hidden">
                              <img src={ep.thumbnail || anime.backdrop || anime.poster} alt={ep.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity group-hover:scale-105 duration-300" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-violet-600/80 p-2 rounded-full text-white backdrop-blur-sm">
                                  <Play fill="currentColor" size={16} />
                                </div>
                              </div>
                              <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 text-[10px] text-white rounded">
                                {season.season_number}x{ep.episode_number}
                              </div>
                            </div>
                            <div className="p-3">
                              <h4 className="text-sm font-bold text-gray-300 group-hover:text-violet-400 line-clamp-2">
                                {ep.episode_number}. {ep.title || `Episode ${ep.episode_number}`}
                              </h4>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            {/* Sidebar metadata if needed, maybe related anime in future */}
          </div>
        </div>
      </div>
    </div>
  );
}
""")

# 16. EpisodeList.tsx
write_file('src/components/EpisodeList.tsx', """
"use client";
import { useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";

export default function EpisodeList({ 
  seasons, 
  episodes, 
  currentAnimeSlug, 
  currentSeasonNum, 
  currentEpNum 
}: { 
  seasons: any[];
  episodes: any[];
  currentAnimeSlug: string;
  currentSeasonNum: number;
  currentEpNum: number;
}) {
  const [activeSeason, setActiveSeason] = useState(currentSeasonNum);

  return (
    <div className="bg-[#1a1a2e] rounded-xl border border-white/5 overflow-hidden flex flex-col h-[500px]">
      <div className="p-4 border-b border-white/5 bg-[#16213e]">
        <h3 className="font-bold text-white mb-3">Episodes</h3>
        <div className="flex overflow-x-auto gap-2 hide-scrollbar pb-1">
          {seasons.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSeason(s.season_number)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-colors
                ${activeSeason === s.season_number ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
            >
              {s.title || `Season ${s.season_number}`}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {episodes
          .filter(e => {
            const season = seasons.find(s => s.id === e.season_id);
            return season && season.season_number === activeSeason;
          })
          .map(ep => {
            const isCurrent = activeSeason === currentSeasonNum && ep.episode_number === currentEpNum;
            return (
              <Link
                key={ep.id}
                href={`/watch/${currentAnimeSlug}/${activeSeason}x${ep.episode_number}`}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors group
                  ${isCurrent ? 'bg-violet-600/20 border border-violet-500/50' : 'hover:bg-white/5 border border-transparent'}`}
              >
                <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs font-bold
                  ${isCurrent ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-400 group-hover:bg-white/20 group-hover:text-white'}`}>
                  {isCurrent ? <Play fill="currentColor" size={12} /> : ep.episode_number}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm truncate ${isCurrent ? 'text-violet-400 font-bold' : 'text-gray-300 font-medium group-hover:text-white'}`}>
                    {ep.title || `Episode ${ep.episode_number}`}
                  </h4>
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
""")

# 17. VideoPlayer.tsx
write_file('src/components/VideoPlayer.tsx', """
"use client";
import { useState } from "react";
import { MonitorPlay, Play } from "lucide-react";

export default function VideoPlayer({ servers }: { servers: any[] }) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!servers || servers.length === 0) {
    return (
      <div className="aspect-video w-full bg-black flex flex-col items-center justify-center text-gray-500">
        <MonitorPlay size={48} className="mb-4 opacity-50" />
        <p>No video servers available for this episode.</p>
      </div>
    );
  }

  const server = servers[activeIdx];

  return (
    <div className="w-full flex flex-col rounded-xl overflow-hidden bg-[#1a1a2e] border border-white/5 shadow-2xl">
      <div className="aspect-video w-full bg-black relative">
        {server.server_type === 'embed' ? (
          <iframe 
            src={server.stream_url} 
            allowFullScreen 
            className="absolute inset-0 w-full h-full border-0"
          ></iframe>
        ) : (
          <video 
            src={server.stream_url} 
            controls 
            className="absolute inset-0 w-full h-full outline-none"
            controlsList="nodownload"
          ></video>
        )}
      </div>
      
      <div className="p-4 bg-[#16213e] flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-400 mr-2 flex items-center gap-1">
          <MonitorPlay size={16} /> Servers:
        </span>
        {servers.map((srv, idx) => (
          <button
            key={srv.id}
            onClick={() => setActiveIdx(idx)}
            className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-colors flex items-center gap-2
              ${activeIdx === idx ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'bg-[#1a1a2e] text-gray-300 hover:bg-white/10 hover:text-white border border-white/5'}`}
          >
            <Play size={14} className={activeIdx === idx ? "fill-white" : ""} /> {srv.server_name}
          </button>
        ))}
      </div>
    </div>
  );
}
""")

# 18. watch/[slug]/[episode]/page.tsx
write_file('src/app/watch/[slug]/[episode]/page.tsx', """
import { getAnimeBySlug, getSeasonsByAnime, getEpisodesByAnime, getServersByEpisode, getDownloadsByEpisode } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Home, Download } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";
import EpisodeList from "@/components/EpisodeList";

export default async function WatchPage({ params }: { params: Promise<{ slug: string, episode: string }> }) {
  const resolvedParams = await params;
  const { slug, episode } = resolvedParams;
  
  const [seasonStr, epStr] = episode.split('x');
  const seasonNum = parseInt(seasonStr);
  const epNum = parseInt(epStr);

  if (isNaN(seasonNum) || isNaN(epNum)) notFound();

  const anime = getAnimeBySlug(slug);
  if (!anime) notFound();

  const seasons = getSeasonsByAnime(anime.id);
  const episodes = getEpisodesByAnime(anime.id);

  const currentSeason = seasons.find(s => s.season_number === seasonNum);
  if (!currentSeason) notFound();

  const currentEp = episodes.find(e => e.season_id === currentSeason.id && e.episode_number === epNum);
  if (!currentEp) notFound();

  const servers = getServersByEpisode(currentEp.id);
  const downloads = getDownloadsByEpisode(currentEp.id);

  // prev / next episode logic
  const seasonEpisodes = episodes.filter(e => e.season_id === currentSeason.id);
  const currentIndex = seasonEpisodes.findIndex(e => e.id === currentEp.id);
  
  const prevEp = currentIndex > 0 ? seasonEpisodes[currentIndex - 1] : null;
  const nextEp = currentIndex < seasonEpisodes.length - 1 ? seasonEpisodes[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-[#0f0f1a] pt-4 pb-20">
      <div className="container mx-auto px-4">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 overflow-x-auto hide-scrollbar whitespace-nowrap">
          <Link href="/" className="hover:text-violet-400 flex items-center gap-1"><Home size={14} /> Home</Link>
          <span>/</span>
          <Link href={`/anime/${anime.slug}`} className="hover:text-violet-400">{anime.title}</Link>
          <span>/</span>
          <span className="text-white">Season {seasonNum} Ep {epNum}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          
          <div className="lg:col-span-3 flex flex-col gap-6">
            <VideoPlayer servers={servers} />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1a1a2e] p-4 rounded-xl border border-white/5">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white mb-1">
                  {anime.title} - Season {seasonNum} Episode {epNum}
                </h1>
                <h2 className="text-sm text-gray-400">
                  {currentEp.title || `Episode ${epNum}`}
                </h2>
              </div>
              
              <div className="flex items-center gap-2">
                {prevEp ? (
                  <Link href={`/watch/${anime.slug}/${seasonNum}x${prevEp.episode_number}`} className="flex items-center gap-1 bg-white/5 hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                    <ChevronLeft size={16} /> Prev
                  </Link>
                ) : (
                  <button disabled className="flex items-center gap-1 bg-white/5 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold cursor-not-allowed">
                    <ChevronLeft size={16} /> Prev
                  </button>
                )}

                {nextEp ? (
                  <Link href={`/watch/${anime.slug}/${seasonNum}x${nextEp.episode_number}`} className="flex items-center gap-1 bg-white/5 hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                    Next <ChevronRight size={16} />
                  </Link>
                ) : (
                  <button disabled className="flex items-center gap-1 bg-white/5 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold cursor-not-allowed">
                    Next <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>

            {downloads.length > 0 && (
              <div className="bg-[#1a1a2e] p-6 rounded-xl border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Download className="text-violet-500" /> Download Links
                </h3>
                <div className="flex flex-wrap gap-3">
                  {downloads.map(dl => (
                    <a 
                      key={dl.id} 
                      href={dl.download_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex flex-col items-center bg-[#16213e] hover:bg-violet-600 border border-white/5 rounded-lg p-3 transition-colors min-w-[120px]"
                    >
                      <span className="font-bold text-white mb-1">{dl.quality}</span>
                      {dl.file_size && <span className="text-xs text-gray-400">{dl.file_size}</span>}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <EpisodeList 
              seasons={seasons} 
              episodes={episodes} 
              currentAnimeSlug={anime.slug} 
              currentSeasonNum={seasonNum} 
              currentEpNum={epNum} 
            />
          </div>

        </div>
      </div>
    </div>
  );
}
""")

if __name__ == "__main__":
    print("All files generated successfully.")
