import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface UnresolvedPenalty {
  id: string;
  event_player_id: string;
  metadata: any;
  created_at: string;
}

export function useUnresolvedPenalties(matchId: string) {
  const [penalties, setPenalties] = useState<UnresolvedPenalty[]>([]);
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    async function loadPenalties() {
      // Find FOULs that awarded a penalty
      const { data: foulData } = await supabase
        .from('referee_events')
        .select('*')
        .eq('match_id', matchId)
        .eq('event_type', 'FOUL')
        .filter('metadata->penaltyAwarded', 'eq', 'true')
        .order('created_at', { ascending: true });

      if (!foulData || foulData.length === 0) {
        if (isMounted) setPenalties([]);
        return;
      }

      // Find all timeline events that resolved a penalty (linked via referee_event_id)
      const foulIds = foulData.map((f: any) => f.id);
      const { data: timelineData } = await supabase
        .from('match_timeline_events')
        .select('referee_event_id')
        .eq('match_id', matchId)
        .in('referee_event_id', foulIds);

      const resolvedIds = new Set((timelineData || []).map((t: any) => t.referee_event_id));

      const unresolved = foulData.filter((f: any) => !resolvedIds.has(f.id));
      if (isMounted) setPenalties(unresolved);
    }

    loadPenalties();

    const channel = supabase
      .channel(`unresolved_penalties_${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'referee_events', filter: `match_id=eq.${matchId}` },
        () => loadPenalties()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_timeline_events', filter: `match_id=eq.${matchId}` },
        () => loadPenalties()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [matchId, supabase]);

  return { penalties };
}
