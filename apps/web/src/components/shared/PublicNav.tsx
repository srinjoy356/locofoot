"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Navigation } from "./Navigation";

function isActive(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function PublicNav({
  isSidebarOpen = true,
  setIsSidebarOpen,
}: {
  isSidebarOpen?: boolean;
  setIsSidebarOpen?: (val: boolean) => void;
}) {
  const pathname = usePathname();
  const exploreActive = isActive(pathname, "/explore");
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (isAuthenticated === null) return null; // Loading state

  if (isAuthenticated) {
    return <Navigation isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />;
  }

  return (
    <>
      {/* Mobile Top App Bar */}
      <header className="md:hidden flex justify-between items-center w-full px-margin-mobile py-4 bg-surface border-b border-outline-variant z-50 sticky top-0">
        <Link href="/explore" className="flex items-center gap-2">
          <span className="w-7 h-7 bg-primary-container flex items-center justify-center text-surface shrink-0">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>sports_soccer</span>
          </span>
          <span className="font-display-sm text-xl font-bold tracking-tighter text-on-surface uppercase leading-none">LocoFoot</span>
        </Link>
        <Link href="/login" className="text-primary-container font-label-caps text-label-caps border border-primary-container px-4 py-2 hover:bg-primary-container hover:text-surface transition-colors duration-200 uppercase tracking-widest">Sign In</Link>
      </header>

      {/* Desktop Side Navigation */}
      <nav className="hidden md:flex flex-col h-screen py-6 px-3 bg-surface-container border-r border-outline-variant fixed left-0 top-0 w-64 z-50 justify-between shrink-0">
        <div className="flex flex-col gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-3 px-2">
            <Link href="/explore" className="flex items-center gap-3 group">
              <span className="w-9 h-9 bg-primary-container flex items-center justify-center text-surface shrink-0 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>sports_soccer</span>
              </span>
              <span className="font-display-sm text-[22px] font-bold tracking-tighter text-on-surface uppercase leading-none">LocoFoot</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_rgba(57,255,106,0.8)]"></span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Spectator Mode</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="px-3 pb-1 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant/50">Menu</span>
            <Link
              href="/explore"
              className={`group relative flex items-center gap-3 pl-3 pr-2 py-2.5 border-l-2 transition-colors ${
                exploreActive
                  ? "border-primary-container bg-primary-container/10 text-primary-container"
                  : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-[22px] shrink-0" style={exploreActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>travel_explore</span>
              <span className="font-label-caps text-label-caps uppercase tracking-widest">Explore</span>
            </Link>
          </div>
        </div>

        {/* Auth CTAs */}
        <div className="flex flex-col gap-2 px-1">
          <Link href="/register" className="w-full text-center bg-primary-container text-surface font-label-caps text-label-caps uppercase tracking-widest py-3 hover:bg-primary-fixed transition-colors">
            Create Account
          </Link>
          <Link href="/login" className="w-full text-center border border-outline-variant text-on-surface font-label-caps text-label-caps uppercase tracking-widest py-3 hover:border-primary-container hover:text-primary-container transition-colors">
            Sign In
          </Link>
        </div>
      </nav>

      {/* Mobile Bottom Nav Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center py-3 bg-surface-container-highest border-t border-outline-variant z-50">
        <Link href="/explore" className={`flex flex-col items-center justify-center active:scale-90 transition-transform ${exploreActive ? "text-primary-container" : "text-on-surface-variant opacity-80"}`}>
          <span className="material-symbols-outlined" style={exploreActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>travel_explore</span>
          <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">Explore</span>
        </Link>
        <Link href="/login" className="flex flex-col items-center justify-center text-on-surface-variant opacity-80 active:scale-90 transition-transform">
          <span className="material-symbols-outlined">login</span>
          <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">Sign In</span>
        </Link>
        <Link href="/register" className="flex flex-col items-center justify-center text-on-surface-variant opacity-80 active:scale-90 transition-transform">
          <span className="material-symbols-outlined">person_add</span>
          <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">Join</span>
        </Link>
      </nav>
    </>
  );
}
