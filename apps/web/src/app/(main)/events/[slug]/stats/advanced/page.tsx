import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdvancedDashboard } from '@/components/analytics/AdvancedDashboard';
import { TurfHero } from '@/components/shared/TurfHero';

export default async function AdvancedAnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const [clutchRes, comebacksRes, recordsRes, trendsRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/statistics/advanced/clutch/${eventId}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/statistics/advanced/comebacks/${eventId}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/statistics/advanced/records/${eventId}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/statistics/advanced/trends/${eventId}`, { next: { revalidate: 60 } })
  ]);

  const clutchData = clutchRes.ok ? await clutchRes.json() : [];
  const comebacksData = comebacksRes.ok ? await comebacksRes.json() : [];
  const recordsData = recordsRes.ok ? await recordsRes.json() : null;
  const trendsData = trendsRes.ok ? await trendsRes.json() : [];

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen">
      <TurfHero
        eyebrow="Advanced Metrics"
        title="Advanced Insights"
        subtitle={eventData.name}
        image="/turf/stadium.jpg"
        size="sm"
      />

      <div className="max-w-6xl mx-auto w-full space-y-6 p-4">
        <div>
           <Link href={`/events/${slug}/stats`} className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:text-on-surface flex items-center gap-2 w-fit">
              ← Back to Overview
           </Link>
        </div>

        <AdvancedDashboard
          clutch={clutchData}
          comebacks={comebacksData}
          records={recordsData}
          trends={trendsData}
          eventSlug={slug}
        />
      </div>
    </div>
  );
}
