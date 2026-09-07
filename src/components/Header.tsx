"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Search, Menu, X, Send, Shuffle, User, LogOut, Bookmark, Download, Crown, Key, Sparkles, Ticket } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import BroadcastBanner from "@/components/BroadcastBanner";

export default function Header() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [keyPass, setKeyPass] = useState<{ active: boolean; remaining_hours: number } | null>(null);

  useEffect(() => {
    if (!user) {
      setKeyPass(null);
      return;
    }
    fetch("/api/keys/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.active && !d.is_vip && d.remaining_hours > 0) {
          setKeyPass({ active: true, remaining_hours: d.remaining_hours });
        } else {
          setKeyPass(null);
        }
      })
      .catch(() => setKeyPass(null));
  }, [user]);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Movies", href: "/movies" },
    { name: "Series", href: "/series" },
    { name: "Anime", href: "/category/anime" },
    { name: "Cartoon", href: "/category/cartoon" },
  ];

  const openSearch = () => {
    window.dispatchEvent(new CustomEvent("open-search-modal"));
  };

  // Listen for scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Listen for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleRandomAnime = async () => {
    try {
      const res = await fetch("/api/anime?limit=20");
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const randomItem = list[Math.floor(Math.random() * list.length)];
        router.push(`/anime/${randomItem.slug}`);
      }
    } catch {}
  };

  return (
    <>
      {/* Live Broadcast & Dynamic Telegram Notification Bar */}
      <BroadcastBanner />

      {/* Crunchyroll-Style Clean Borderless Header */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-[#000000]/95 backdrop-blur-md shadow-2xl"
            : "bg-[#000000]/85 backdrop-blur-sm"
        }`}
      >
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-1 group select-none py-1">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-white group-hover:opacity-90 transition-opacity">
                Anime
              </span>
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-[#ff640a] group-hover:brightness-110 transition-all">
                Zone
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-2 text-sm font-bold">
              {navLinks.map((link) => {
                const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`px-3 py-1.5 transition-colors relative uppercase tracking-wide text-xs md:text-sm ${
                      active
                        ? "text-[#ff640a]"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    <span>{link.name}</span>
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#ff640a] rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Search Bar & User Actions */}
          <div className="flex items-center gap-3">
            
            {/* Clean Pill Search Bar */}
            <button
              onClick={openSearch}
              className="flex items-center gap-3 bg-[#1e1e24] hover:bg-[#282830] text-gray-400 hover:text-white py-2 px-4 rounded-full text-xs sm:text-sm transition-all group"
            >
              <Search size={16} className="text-gray-400 group-hover:text-[#ff640a] transition-colors" />
              <span className="hidden sm:inline font-medium text-gray-300">Search anime...</span>
              <span className="sm:hidden font-medium text-gray-300 text-xs">Search</span>
              <kbd className="hidden md:inline-block bg-black/40 text-[10px] font-mono px-1.5 py-0.5 rounded text-gray-500">
                ⌘K
              </kbd>
            </button>

            {/* Random Shuffle Button */}
            <button
              onClick={handleRandomAnime}
              title="Watch Random Anime"
              className="p-2 text-gray-400 hover:text-[#ff640a] hover:bg-[#1e1e24] rounded-full transition-all hidden sm:flex items-center justify-center"
            >
              <Shuffle size={18} />
            </button>

            {/* Watchlist Link */}
            <Link
              href="/watchlist"
              title="My Watchlist"
              className="p-2 text-gray-400 hover:text-[#ff640a] hover:bg-[#1e1e24] rounded-full transition-all hidden sm:flex items-center justify-center"
            >
              <Bookmark size={18} />
            </Link>

            {/* 🔑 Key Pass Status Pill or Get Key CTA */}
            {keyPass && keyPass.active ? (
              <Link
                href="/verify-key"
                title={`${keyPass.remaining_hours} hours remaining on your video pass`}
                className="hidden sm:inline-flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm shadow-amber-500/10"
              >
                <Sparkles size={12} className="text-amber-400 animate-pulse" />
                <span>Pass: {keyPass.remaining_hours}h</span>
              </Link>
            ) : (
              <Link
                href="/verify-key"
                title="Get 48-Hour Free Access Key"
                className="hidden sm:inline-flex items-center gap-1.5 bg-[#1e1e24] hover:bg-[#282830] border border-amber-500/30 text-amber-400 hover:text-amber-300 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all"
              >
                <Key size={12} />
                <span>Get Key</span>
              </Link>
            )}

            {/* User Login / Profile Controls */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdown(!userDropdown)}
                  className="flex items-center gap-2 bg-[#1e1e24] hover:bg-[#282830] text-white px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-[#ff640a] flex items-center justify-center text-white text-[11px] font-black uppercase">
                    {user.username.charAt(0)}
                  </div>
                  <span className="hidden sm:inline max-w-[100px] truncate">{user.username}</span>
                </button>

                {userDropdown && (
                  <div className="absolute right-0 mt-2 w-52 bg-[#141519] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-4 py-2 border-b border-white/5">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-white truncate">{user.username}</p>
                        {user.is_vip === 1 && (
                          <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 shrink-0">
                            <Crown size={10} /> VIP
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                    </div>

                    <Link
                      href="/account"
                      onClick={() => setUserDropdown(false)}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                      <User size={14} className="text-[#ff640a]" /> My Account
                    </Link>

                    <Link
                      href="/account"
                      onClick={() => setUserDropdown(false)}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                      <Ticket size={14} className="text-amber-400" />
                      <span>{user.is_vip === 1 ? "VIP Membership" : "Redeem VIP Code"}</span>
                    </Link>

                    {user.is_vip === 1 && (
                      <Link
                        href="/account?tab=downloads"
                        onClick={() => setUserDropdown(false)}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-white/5 flex items-center gap-2 transition-colors"
                      >
                        <Download size={14} /> My VIP Downloads
                      </Link>
                    )}

                    <Link
                      href="/verify-key"
                      onClick={() => setUserDropdown(false)}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                      <Key size={14} /> {keyPass?.active ? `48h Pass (${keyPass.remaining_hours}h left)` : "Get 48h Access Key"}
                    </Link>

                    <Link
                      href="/watchlist"
                      onClick={() => setUserDropdown(false)}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors border-b border-white/5"
                    >
                      <Bookmark size={14} className="text-[#ff640a]" /> My Watchlist
                    </Link>

                    <button
                      onClick={() => {
                        logout();
                        setUserDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-red-400 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={14} /> Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-xs font-bold text-gray-300 hover:text-white px-3 py-1.5 rounded hover:bg-[#1e1e24] transition-all"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="bg-[#ff640a] hover:bg-[#e05300] text-white text-xs font-bold px-3.5 py-1.5 rounded transition-all shadow-md hidden sm:inline-block"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenu(true)}
              className="lg:hidden p-2 text-gray-300 hover:text-white rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenu && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenu(false)}
          />

          <div className="relative w-72 max-w-[80%] bg-[#0f1015] h-full flex flex-col p-5 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
              <div className="flex items-center gap-1">
                <span className="font-black text-xl text-white">Anime</span>
                <span className="font-black text-xl text-[#ff640a]">Zone</span>
              </div>
              <button
                onClick={() => setMobileMenu(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav Links */}
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileMenu(false)}
                    className={`px-4 py-2.5 rounded font-bold text-sm transition-all ${
                      active
                        ? "bg-[#ff640a] text-white"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
              <Link
                href="/verify-key"
                onClick={() => setMobileMenu(false)}
                className="px-4 py-2.5 rounded font-bold text-sm text-amber-400 hover:text-amber-300 hover:bg-white/5 flex items-center gap-2 transition-all"
              >
                <Key size={16} /> {keyPass?.active ? `48h Pass (${keyPass.remaining_hours}h)` : "Get 48-Hour Key"}
              </Link>
              <Link
                href="/watchlist"
                onClick={() => setMobileMenu(false)}
                className={`px-4 py-2.5 rounded font-bold text-sm transition-all flex items-center gap-2 ${
                  pathname === "/watchlist"
                    ? "bg-[#ff640a] text-white"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Bookmark size={16} /> My Watchlist
              </Link>
            </nav>

            {/* User Account / Auth buttons in Mobile Drawer */}
            <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
              {user ? (
                <div className="flex flex-col gap-2">
                  <div className="p-3 bg-[#1e1e24] rounded-lg">
                    <p className="text-xs font-bold text-white">{user.username}</p>
                    <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenu(false);
                    }}
                    className="w-full py-2 px-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded flex items-center justify-center gap-2"
                  >
                    <LogOut size={14} /> Log Out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenu(false)}
                    className="w-full py-2.5 px-4 bg-[#1e1e24] text-gray-200 rounded font-semibold text-sm text-center"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileMenu(false)}
                    className="w-full py-2.5 px-4 bg-[#ff640a] text-white rounded font-bold text-sm text-center"
                  >
                    Sign Up Free
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
