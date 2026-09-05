import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TeamsClientTable } from '@/components/TeamsClientTable';
import { TurfHero } from '@/components/shared/TurfHero';

export default async function TournamentTeamsHubPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const res = await fetch(`${apiUrl}/api/v1/statistics/standings/${eventId}`, { next: { revalidate: 60 } });
  const items = res.ok ? await res.json() : [];

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen">
      <TurfHero
        eyebrow={eventData.name}
        title={<>Teams <span className="text-primary-container">Hub</span></>}
        image="/turf/aerial-goal.jpg"
        size="sm"
      />

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-6">
        <Link href={`/events/${slug}/stats`} className="inline-flex items-center gap-2 w-fit font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:text-primary-container transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span> Back to Overview
        </Link>

        <TeamsClientTable teams={items} eventSlug={slug} />
      </div>
    </div>
  );
}
