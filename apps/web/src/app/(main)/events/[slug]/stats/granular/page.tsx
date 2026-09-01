import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GranularDashboard } from '@/components/analytics/GranularDashboard';
import { Target } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

async function GranularAnalyticsContent({ slug }: { slug: string }) {
  const supabase = await createClient();
  
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

  const [shotMapRes, playmakingRes, goalkeepingRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/statistics/granular/shot-map/${eventId}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/statistics/granular/playmaking/${eventId}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/statistics/granular/goalkeeping/${eventId}`, { next: { revalidate: 60 } }),
  ]);

  const shotMap = shotMapRes.ok ? await shotMapRes.json() : [];
  const playmaking = playmakingRes.ok ? await playmakingRes.json() : {};
  const goalkeeping = goalkeepingRes.ok ? await goalkeepingRes.json() : {};

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <div>
         <Link href={`/events/${slug}/stats`} className="text-sm text-zinc-400 hover:text-white flex items-center gap-2 w-fit mb-4">
            ← Back to Overview
         </Link>
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
             <Target className="w-5 h-5 text-orange-400" />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-white tracking-tight">Granular Event Analytics</h1>
             <p className="text-sm text-zinc-400">{eventData.name}</p>
           </div>
         </div>
      </div>

      <GranularDashboard 
        shotMap={shotMap || []} 
        playmaking={playmaking || {}} 
        goalkeeping={goalkeeping || {}} 
        eventSlug={slug}
      />
    </div>
  );
}

export default async function GranularAnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GranularAnalyticsContent slug={slug} />;
}
