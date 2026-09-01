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
    <nav className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between text-sm">
        <div className="flex gap-4 items-center">
          <Link href="/dashboard" className="font-bold text-gray-900 text-base">LocoFoot</Link>
          <Link href="/events" className="text-gray-600 hover:text-black font-medium">Events</Link>
          <Link href="/friends" className="text-gray-600 hover:text-black font-medium">Friends</Link>
          <Link href="/admin/events" className="text-gray-600 hover:text-black font-medium">Organizer</Link>
        </div>
        <div className="flex gap-4 items-center">
          {uniqueCode && <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono text-xs select-all border border-gray-200">Code: {uniqueCode}</span>}
          <Link href="/notifications" className="relative text-gray-600 hover:text-black font-medium">
            Notifs
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}
