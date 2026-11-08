'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TurfHero } from '@/components/shared/TurfHero';
import { LeaderboardTable } from '@/components/predictions/LeaderboardTable';

export default function PredictionLeaderboardPage() {
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [eventId, setEventId] = useState('');
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user.id ?? null));
    supabase.from('events').select('id, name').neq('status', 'DRAFT').order('created_at', { ascending: false }).limit(50).then(({ data }) => setEvents(data || []));
  }, []);

  return (
    <div className="flex w-full flex-col bg-background text-on-surface">
      <TurfHero eyebrow="Predictions" title={<>Prediction <span className="text-primary-container">Leaderboard</span></>} subtitle="Ranked by profit on settled predictions." image="/turf/aerial-field.jpg" size="sm" />
      <div className="mx-auto w-full max-w-container-max px-margin-mobile py-8 md:px-gutter">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-3 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
            Show
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="border border-outline-variant bg-background px-3 py-2 text-on-surface">
              <option value="">All tournaments</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <Link href="/predict" className="font-label-caps text-[10px] uppercase tracking-widest text-primary-container">Back to live matches</Link>
        </div>
        <div className="border border-outline-variant bg-surface">
          <LeaderboardTable eventId={eventId || null} limit={100} meId={me} />
        </div>
      </div>
    </div>
  );
}
