"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  icon: string;
  label: string;
  prefix: string;
  badge?: boolean;
};

const PRIMARY: NavItem[] = [
  { href: "/dashboard", icon: "space_dashboard", label: "Dashboard", prefix: "/dashboard" },
  { href: "/explore", icon: "travel_explore", label: "Explore", prefix: "/explore" },
  { href: "/events", icon: "stadium", label: "Events", prefix: "/events" },
  { href: "/friends", icon: "group", label: "Friends", prefix: "/friends" },
  { href: "/admin/events", icon: "admin_panel_settings", label: "Organizer", prefix: "/admin" },
];

const ACCOUNT: NavItem[] = [
  { href: "/notifications", icon: "notifications", label: "Alerts", prefix: "/notifications", badge: true },
  { href: "/settings", icon: "settings", label: "Settings", prefix: "/settings" },
  { href: "/u/me", icon: "person", label: "Profile", prefix: "/u" },
];

const MOBILE: NavItem[] = [
  { href: "/dashboard", icon: "space_dashboard", label: "Home", prefix: "/dashboard" },
  { href: "/explore", icon: "travel_explore", label: "Explore", prefix: "/explore" },
  { href: "/events", icon: "stadium", label: "Events", prefix: "/events" },
  { href: "/friends", icon: "group", label: "Friends", prefix: "/friends" },
];

function isActive(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function Navigation({
  isSidebarOpen = true,
  setIsSidebarOpen,
}: {
  isSidebarOpen?: boolean;
  setIsSidebarOpen?: (val: boolean) => void;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [uniqueCode, setUniqueCode] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    async function loadUserAndNotifications() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", session.user.id)
        .is("read_at", null);

      setUnreadCount(count || 0);

      const { data: user } = await supabase.from('users').select('unique_code').eq('id', session.user.id).single();
      if (user?.unique_code) {
        setUniqueCode(user.unique_code);
      }
    }
    loadUserAndNotifications();
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => setUnreadCount((c) => c + 1)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new.read_at && !payload.old.read_at) setUnreadCount((c) => Math.max(0, c - 1));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (!userId) return null;

  const renderRow = (item: NavItem) => {
    const active = isActive(pathname, item.prefix);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group relative flex items-center gap-3 pl-3 pr-2 py-2.5 border-l-2 transition-colors ${
          active
            ? "border-primary-container bg-primary-container/10 text-primary-container"
            : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
        }`}
      >
        <span
          className="material-symbols-outlined text-[22px] shrink-0"
          style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {item.icon}
        </span>
        <span className="font-label-caps text-label-caps uppercase tracking-widest">{item.label}</span>
        {item.badge && unreadCount > 0 && (
          <span className="ml-auto bg-error text-on-error font-mono text-[9px] font-bold px-1.5 py-0.5 leading-tight">
            {unreadCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Top App Bar */}
      <header className="md:hidden flex justify-between items-center w-full px-margin-mobile py-4 bg-surface border-b border-outline-variant z-50 sticky top-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-on-surface-variant hover:text-on-surface active:scale-95 transition-transform flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="w-7 h-7 bg-primary-container flex items-center justify-center text-surface shrink-0">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>sports_soccer</span>
            </span>
            <span className="font-display-sm text-xl font-bold tracking-tighter text-on-surface uppercase leading-none hidden sm:block">LocoFoot</span>
          </Link>
        </div>
        <div className="flex gap-4 items-center">
          {uniqueCode && <span className="bg-surface-variant text-on-surface-variant px-2 py-1 font-mono text-xs select-all border border-outline-variant">Code: {uniqueCode}</span>}
          <Link href="/notifications" className="relative text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-error text-on-error font-mono text-[9px] font-bold px-1 leading-tight">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Mobile Backdrop */}
      <div 
        className={`md:hidden fixed inset-0 bg-black/60 z-[55] transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsMobileMenuOpen(false)} 
      />

      {/* Side Navigation (Desktop + Mobile Drawer) */}
      <nav className={`flex flex-col h-screen py-6 px-3 bg-surface-container border-r border-outline-variant fixed left-0 top-0 w-64 z-[60] justify-between shrink-0 transform transition-transform duration-300 ease-out ${isMobileMenuOpen || isSidebarOpen ? 'translate-x-0 shadow-2xl md:shadow-none' : '-translate-x-full'}`}>
        <div className="flex flex-col gap-8 min-h-0">
          {/* Brand */}
          <div className="flex items-center justify-between px-2">
            <Link href="/dashboard" className="flex items-center gap-3 group shrink-0">
              <span className="w-9 h-9 bg-primary-container flex items-center justify-center text-surface shrink-0 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>sports_soccer</span>
              </span>
              <span className="font-display-sm text-[22px] font-bold tracking-tighter text-on-surface uppercase leading-none">LocoFoot</span>
            </Link>
            <button 
              className="md:hidden text-on-surface-variant hover:text-on-surface"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            {setIsSidebarOpen && (
              <button 
                className="hidden md:flex text-on-surface-variant hover:text-on-surface items-center justify-center"
                onClick={() => setIsSidebarOpen(false)}
              >
                <span className="material-symbols-outlined text-[24px]">menu_open</span>
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="px-3 pb-1 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant/50">Menu</span>
            {PRIMARY.map(renderRow)}
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <span className="px-3 pb-1 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant/50">Account</span>
          {ACCOUNT.map(renderRow)}
          {uniqueCode && (
            <div className="mt-3 mx-1 flex items-center justify-between gap-2 bg-background border border-outline-variant px-3 py-2">
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Code</span>
              <span className="font-mono text-xs text-primary-container font-bold tracking-widest select-all">{uniqueCode}</span>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Nav Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center py-3 bg-surface-container-highest border-t border-outline-variant z-50">
        {MOBILE.map((item) => {
          const active = isActive(pathname, item.prefix);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center active:scale-90 transition-transform ${active ? "text-primary-container" : "text-on-surface-variant opacity-80"}`}
            >
              <span className="material-symbols-outlined" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
              <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop Floating Open Button */}
      {setIsSidebarOpen && !isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="hidden md:flex fixed top-6 left-6 z-[40] w-12 h-12 bg-surface-container border border-outline-variant rounded-full items-center justify-center text-on-surface-variant hover:text-on-surface hover:scale-105 transition-all shadow-lg"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
      )}
    </>
  );
}
