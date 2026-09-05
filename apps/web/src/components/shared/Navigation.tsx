"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function Navigation() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [uniqueCode, setUniqueCode] = useState<string | null>(null);
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

  if (!userId) return null;

  return (
    <>
      {/* Mobile Top App Bar */}
      <header className="md:hidden flex justify-between items-center w-full px-margin-mobile py-4 bg-surface border-b border-outline-variant z-50 sticky top-0">
        <Link href="/dashboard" className="font-display-sm text-display-sm font-bold tracking-tighter text-on-surface uppercase">REACTOR ELITE</Link>
        <div className="flex gap-4 items-center">
          {uniqueCode && <span className="bg-surface-variant text-on-surface-variant px-2 py-1 font-mono text-xs select-all border border-outline-variant">Code: {uniqueCode}</span>}
          <Link href="/notifications" className="relative text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-error text-on-error font-mono text-[9px] font-bold px-1 rounded-none border border-error leading-tight">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Desktop Side Navigation */}
      <nav className="hidden md:flex flex-col h-screen py-8 px-4 bg-surface-container border-r border-outline-variant fixed left-0 top-0 w-[80px] z-50 items-center justify-between shrink-0">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Brand Mark */}
          <Link href="/dashboard" className="w-10 h-10 bg-on-surface rounded-none flex items-center justify-center text-surface font-black text-xl tracking-tighter hover:scale-105 transition-transform" title="Home">
            R
          </Link>
          
          <div className="flex flex-col gap-6 w-full">
            <Link href="/dashboard" className="flex flex-col items-center justify-center w-12 h-12 rounded-none text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors relative group" title="Dashboard">
              <span className="material-symbols-outlined group-hover:text-primary-container transition-colors">home</span>
            </Link>
            
            <Link href="/explore" className="flex flex-col items-center justify-center w-12 h-12 rounded-none text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors relative group" title="Explore">
              <span className="material-symbols-outlined group-hover:text-primary-container transition-colors">travel_explore</span>
            </Link>
            
            <Link href="/events" className="flex flex-col items-center justify-center w-12 h-12 rounded-none text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors relative group" title="Events">
              <span className="material-symbols-outlined group-hover:text-primary-container transition-colors">event</span>
            </Link>
            
            <Link href="/friends" className="flex flex-col items-center justify-center w-12 h-12 rounded-none text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors relative group" title="Friends">
              <span className="material-symbols-outlined group-hover:text-primary-container transition-colors">group</span>
            </Link>

            <Link href="/admin/events" className="flex flex-col items-center justify-center w-12 h-12 rounded-none text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors relative group" title="Organizer">
              <span className="material-symbols-outlined group-hover:text-primary-container transition-colors">admin_panel_settings</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-6 w-full items-center">
          <Link href="/notifications" className="flex flex-col items-center justify-center w-12 h-12 rounded-none text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors relative group" title="Notifications">
            <span className="material-symbols-outlined group-hover:text-primary-container transition-colors">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 bg-error text-on-error font-mono text-[9px] font-bold px-1 rounded-none border border-error leading-tight">
                {unreadCount}
              </span>
            )}
          </Link>
          <Link href="/settings" className="flex flex-col items-center justify-center w-12 h-12 rounded-none text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors relative group" title="Settings">
            <span className="material-symbols-outlined group-hover:text-primary-container transition-colors">settings</span>
          </Link>
          <Link href="/u/me" className="w-10 h-10 rounded-none bg-surface-variant border border-outline-variant flex items-center justify-center overflow-hidden hover:border-primary-container transition-colors" title="Profile">
            <span className="material-symbols-outlined text-sm">person</span>
          </Link>
        </div>
      </nav>

      {/* Mobile Bottom Nav Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center py-3 bg-surface-container-highest border-t border-outline-variant z-50">
        <Link href="/dashboard" className="flex flex-col items-center justify-center text-primary-container opacity-80 active:scale-90 transition-transform">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
          <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">Home</span>
        </Link>
        <Link href="/explore" className="flex flex-col items-center justify-center text-on-surface-variant opacity-80 active:scale-90 transition-transform">
          <span className="material-symbols-outlined">search</span>
          <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">Explore</span>
        </Link>
        <Link href="/events" className="flex flex-col items-center justify-center text-on-surface-variant opacity-80 active:scale-90 transition-transform">
          <span className="material-symbols-outlined">event</span>
          <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">Events</span>
        </Link>
        <Link href="/friends" className="flex flex-col items-center justify-center text-on-surface-variant opacity-80 active:scale-90 transition-transform">
          <span className="material-symbols-outlined">group</span>
          <span className="font-label-caps text-label-caps mt-1 text-[10px] uppercase">Friends</span>
        </Link>
      </nav>
    </>
  );
}
