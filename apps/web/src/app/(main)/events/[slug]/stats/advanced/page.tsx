import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdvancedDashboard } from '@/components/analytics/AdvancedDashboard';
import { Zap } from 'lucide-react';

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
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <div>
         <Link href={`/events/${slug}/stats`} className="text-sm text-zinc-400 hover:text-white flex items-center gap-2 w-fit mb-4">
            ← Back to Overview
         </Link>
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
             <Zap className="w-5 h-5 text-orange-400" />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-white tracking-tight">Advanced Insights</h1>
             <p className="text-sm text-zinc-400">{eventData.name}</p>
           </div>
         </div>
      </div>

      <AdvancedDashboard 
        clutch={clutchData} 
        comebacks={comebacksData} 
        records={recordsData} 
        trends={trendsData} 
        eventSlug={slug} 
      />
    </div>
  );
}
