'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Film, PlusCircle, Star, Menu, X, LogOut, Megaphone, Users, Key, Settings, MonitorCog } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token && !pathname.includes('/admin/login')) {
      router.push('/admin/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [pathname, router]);

  if (!isAuthenticated && !pathname.includes('/admin/login')) return null;

  if (pathname.includes('/admin/login')) {
    return <div className="min-h-screen bg-[#0f0f1a] text-white">{children}</div>;
  }

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Anime List', href: '/admin/anime', icon: Film },
    { name: 'Add Anime', href: '/admin/anime/new', icon: PlusCircle },
    { name: 'Spotlight', href: '/admin/spotlight', icon: Star },
    { name: 'Broadcast & Telegram', href: '/admin/broadcasts', icon: Megaphone },
    { name: 'User Management', href: '/admin/users', icon: Users },
    { name: 'Key System (Shortener)', href: '/admin/keys', icon: Key },
    { name: 'System Status', href: '/admin/system', icon: MonitorCog },
    { name: 'Settings (Password)', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#0f0f1a] text-white overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1a1a2e] border-r border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-violet-500">Admin Panel</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.name} href={item.href} className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${pathname === item.href ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <item.icon size={20} />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={() => { localStorage.removeItem('adminToken'); router.push('/admin/login'); }} className="flex items-center space-x-3 p-3 w-full rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-[#1a1a2e] border-b border-slate-800">
          <h1 className="text-xl font-bold text-violet-500">Admin</h1>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-400 hover:text-white">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 z-50 bg-[#1a1a2e] border-b border-slate-800 p-4">
            <nav className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <Link key={item.name} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-3 rounded-lg ${pathname === item.href ? 'bg-violet-600 text-white' : 'text-slate-400'}`}>
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </Link>
              ))}
              <button onClick={() => { localStorage.removeItem('adminToken'); router.push('/admin/login'); }} className="flex items-center space-x-3 p-3 w-full rounded-lg text-red-500">
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </nav>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-[#0f0f1a] p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
