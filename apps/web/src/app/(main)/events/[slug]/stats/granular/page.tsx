import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GranularDashboard } from '@/components/analytics/GranularDashboard';
import { createClient } from '@/lib/supabase/server';
import { TurfHero } from '@/components/shared/TurfHero';

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
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen">
      <TurfHero
        eyebrow="Analytics"
        title="Granular Event Analytics"
        subtitle={eventData.name}
        image="/turf/turf-closeup.jpg"
        size="sm"
      />

      <div className="max-w-6xl mx-auto w-full space-y-6 p-4">
        <div>
           <Link href={`/events/${slug}/stats`} className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:text-on-surface flex items-center gap-2 w-fit">
              ← Back to Overview
           </Link>
        </div>

        <GranularDashboard
          shotMap={shotMap || []}
          playmaking={playmaking || {}}
          goalkeeping={goalkeeping || {}}
          eventSlug={slug}
        />
      </div>
    </div>
  );
}

export default async function GranularAnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GranularAnalyticsContent slug={slug} />;
}
