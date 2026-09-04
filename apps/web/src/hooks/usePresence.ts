import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function usePresence(roomName: string) {
  const [viewerCount, setViewerCount] = useState<number>(0);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase.channel(`presence:${roomName}`, {
      config: {
        presence: {
          key: 'viewer',
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // sum up all presence states for all clients
        let total = 0;
        for (const id in state) {
          total += state[id].length;
        }
        setViewerCount(total);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Not strictly needed since sync handles total count, but can be used for specifics
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // Same as join
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // You must track something to show up in presence
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomName, supabase]);

  return viewerCount;
}
