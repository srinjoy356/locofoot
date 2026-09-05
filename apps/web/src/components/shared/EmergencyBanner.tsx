'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, Info, X } from 'lucide-react';

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
    <div className={`${announcement.is_emergency ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface border-b border-outline-variant'} px-margin-mobile md:px-gutter py-3 relative`}>
      <div className="flex items-center gap-3 max-w-container-max mx-auto w-full">
        {announcement.is_emergency ? (
          <AlertTriangle className="h-6 w-6 shrink-0 animate-pulse" />
        ) : (
          <Info className="h-6 w-6 text-primary-container shrink-0" />
        )}
        <div className="flex-1">
          <p className={`font-label-caps text-label-caps uppercase tracking-widest ${announcement.is_emergency ? 'text-on-error-container' : 'text-primary-container'}`}>
            {announcement.is_emergency ? 'Emergency Announcement' : 'Announcement'}
          </p>
          <p className="font-body-md">{announcement.message}</p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className={`p-1 shrink-0 transition-colors ${announcement.is_emergency ? 'hover:bg-on-error-container/10' : 'hover:bg-surface-variant'}`}
          title="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
