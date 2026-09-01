import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { BarChart3 } from 'lucide-react';

export default async function TournamentAnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const { slug } = await params;
  
  let eventId = slug;
  let eventData = null;
  if (slug.length < 30) {
    const { data } = await supabase.from('events').select('id, name').eq('slug', slug).maybeSingle();
    if (!data) notFound();
    eventId = data.id;
    eventData = data;
  } else {
    const { data } = await supabase.from('events').select('id, name').eq('id', slug).maybeSingle();
    if (!data) notFound();
    eventData = data;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

  const [playersRes, teamsRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/statistics/tournament-players/${eventId}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/statistics/standings/${eventId}`, { next: { revalidate: 60 } })
  ]);

  const players = playersRes.ok ? await playersRes.json() : [];
  const teams = teamsRes.ok ? await teamsRes.json() : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <div>
         <Link href={`/events/${slug}/stats`} className="text-sm text-zinc-400 hover:text-white flex items-center gap-2 w-fit mb-4">
            ← Back to Overview
         </Link>
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-locofoot-500/20 flex items-center justify-center">
             <BarChart3 className="w-5 h-5 text-locofoot-400" />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-white tracking-tight">Tournament Analytics</h1>
             <p className="text-sm text-zinc-400">{eventData.name}</p>
           </div>
         </div>
      </div>

      <AnalyticsDashboard players={players} teams={teams} eventSlug={slug} />
    </div>
  );
}
