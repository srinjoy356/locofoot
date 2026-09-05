'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, X } from 'lucide-react';

interface Announcement {
  id: string;
  message: string;
  is_emergency: boolean;
  created_at: string;
}

export function EmergencyBanner({ eventId }: { eventId: string }) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let channel: any;

    const initBanner = async () => {
      // 1. Resolve slug to event_id
      let resolvedEventId = eventId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId);
      
      if (!isUuid) {
        const { data: eventData } = await supabase
          .from('events')
          .select('id')
          .eq('slug', eventId)
          .single();
          
        if (!eventData) return; // Cannot resolve event
        resolvedEventId = eventData.id;
      }

      // 2. Fetch latest announcement (emergency or not)
      const { data } = await supabase
        .from('event_announcements')
        .select('*')
        .eq('event_id', resolvedEventId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setAnnouncement(data[0]);
        setIsVisible(true);
      }

      // 3. Subscribe to new announcements
      const channelName = `event_announcements_${resolvedEventId}_${Math.random().toString(36).substring(7)}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'event_announcements',
            filter: `event_id=eq.${resolvedEventId}`,
          },
          (payload) => {
            const newAnnouncement = payload.new as Announcement;
            setAnnouncement(newAnnouncement);
            setIsVisible(true);
          }
        )
        .subscribe();
    };

    initBanner();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  if (!isVisible || !announcement) return null;

  return (
    <div className={`${announcement.is_emergency ? 'bg-red-600' : 'bg-blue-600'} text-white px-4 py-3 shadow-lg relative flex items-center justify-between`}>
      <div className="flex items-center space-x-3 max-w-7xl mx-auto w-full">
        {announcement.is_emergency ? (
          <AlertTriangle className="h-6 w-6 text-red-200 shrink-0 animate-pulse" />
        ) : (
          <div className="text-xl">ℹ️</div>
        )}
        <div className="flex-1">
          <p className={`font-bold text-sm uppercase tracking-wider ${announcement.is_emergency ? 'text-red-200' : 'text-blue-200'}`}>
            {announcement.is_emergency ? 'Emergency Announcement' : 'Announcement'}
          </p>
          <p className="font-medium">{announcement.message}</p>
        </div>
        <button 
          onClick={() => setIsVisible(false)}
          className={`p-1 hover:${announcement.is_emergency ? 'bg-red-700' : 'bg-blue-700'} rounded transition-colors`}
          title="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
