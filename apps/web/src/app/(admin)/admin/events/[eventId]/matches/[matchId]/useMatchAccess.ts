import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// null while checking. Mirrors the API guard: staff in an allowed role, or a referee assigned to this match.
// The API is the real gate; this keeps people who cannot act from seeing a console that would only fail.
export function useMatchAccess(eventId: string, matchId: string, roles: string[]) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setAllowed(false);
      const { data: assigned } = await supabase.from('match_referees').select('id').eq('match_id', matchId).eq('user_id', session.user.id).maybeSingle();
      if (assigned) return setAllowed(true);
      const { data: found } = await supabase.from('event_roles').select('role').eq('event_id', eventId).eq('user_id', session.user.id).in('role', roles).limit(1);
      setAllowed(!!found?.length);
    })();
  }, [eventId, matchId]);

  return allowed;
}
