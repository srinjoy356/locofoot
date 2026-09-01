import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LeaderboardTable } from '@/components/LeaderboardTable';

const categories = [
  {
    name: 'ATTACK & PLAYMAKING',
    metrics: [
      { id: 'goals', apiLabel: 'golden-boot', title: 'Top Scorers', colLabel: 'Goals' },
      { id: 'assists', apiLabel: 'playmaker', title: 'Top Assists', colLabel: 'Assists' },
      { id: 'goal-contributions', apiLabel: 'goal-contributions', title: 'Goal Contributions', colLabel: 'G+A' },
    ]
  },
  {
    name: 'DEFENDING',
    metrics: [
      { id: 'tackles', apiLabel: 'tackle-masters', title: 'Tackle Masters', colLabel: 'Tackles Won' },
      { id: 'interceptions', apiLabel: 'interceptions', title: 'Interceptions', colLabel: 'Ints' },
      { id: 'recoveries', apiLabel: 'recoveries', title: 'Recoveries', colLabel: 'Rec' },
    ]
  },
  {
    name: 'GOALKEEPING',
    metrics: [
      { id: 'saves', apiLabel: 'saves', title: 'Saves', colLabel: 'Saves' },
    ]
  },
  {
    name: 'DISCIPLINE',
    metrics: [
      { id: 'cards', apiLabel: 'yellow-cards', title: 'Yellow Cards', colLabel: 'YC' },
      { id: 'red-cards', apiLabel: 'red-cards', title: 'Red Cards', colLabel: 'RC' },
    ]
  }
];

export default async function LeaderboardPage({ params }: { params: Promise<{ slug: string, metric: string }> }) {
  const supabase = await createClient();
  const { slug, metric } = await params;
  
  // Find valid metric config
  let mConfig = null;
  for (const cat of categories) {
    const found = cat.metrics.find(m => m.id === metric);
    if (found) mConfig = found;
  }

  if (!mConfig) {
    notFound();
  }

  // Resolve event
  let eventId = slug;
  if (slug.length < 30) {
    const { data } = await supabase.from('events').select('id, name').eq('slug', slug).maybeSingle();
    if (!data) notFound();
    eventId = data.id;
  } else {
    const { data } = await supabase.from('events').select('id, name').eq('id', slug).maybeSingle();
    if (!data) notFound();
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  // Fetch full leaderboard (up to 100)
  const res = await fetch(`${apiUrl}/api/v1/statistics/leaderboards/${mConfig.apiLabel}?event_id=${eventId}&limit=100`, { next: { revalidate: 60 } });
  
  const items = res.ok ? (await res.json()).data : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 text-zinc-100">
      <div>
         <Link href={`/events/${slug}/stats`} className="text-sm text-zinc-400 hover:text-white flex items-center gap-2 w-fit mb-4">
            ← Back to Overview
         </Link>
      </div>
      
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 flex-shrink-0 space-y-6">
          {categories.map((cat) => (
            <div key={cat.name}>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-3">{cat.name}</div>
              <div className="space-y-1">
                {cat.metrics.map(m => (
                  <Link 
                    key={m.id} 
                    href={`/events/${slug}/stats/${m.id}`}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${metric === m.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                  >
                    {m.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden p-1">
            <LeaderboardTable 
              title={mConfig.title}
              metricLabel={mConfig.colLabel}
              data={items} 
              loading={false} 
              eventSlug={slug}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
