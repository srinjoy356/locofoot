"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TurfHero } from "@/components/shared/TurfHero";

export default function PublicEventTeamsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [event, setEvent] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // Find event
      let eventData;
      const { data } = await supabase.from('events').select('*').eq('id', slug).single();
      if (data) eventData = data;
      else {
        const { data: bySlug } = await supabase.from('events').select('*').eq('slug', slug).single();
        if (bySlug) eventData = bySlug;
      }
      
      if (!eventData) return;
      setEvent(eventData);

      // fetch teams using an unauthenticated approach if possible, or just through direct supabase 
      // query if RLS allows public select on event_team_registrations (it does!)
      const { data: regs } = await supabase
        .from('event_team_registrations')
        .select('*')
        .eq('event_id', eventData.id)
        .eq('status', 'APPROVED');
      
      if (regs) setRegistrations(regs);
    }
    load();
  }, [slug, supabase]);

  if (!event) return (
    <div className="w-full flex items-center justify-center min-h-[50vh] bg-background">
      <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest animate-pulse">LOADING TEAMS...</div>
    </div>
  );

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      <TurfHero
        eyebrow="Participating Teams"
        title={event.name}
        subtitle="Every approved squad competing in this tournament."
        image="/turf/aerial-field.jpg"
        size="sm"
        actions={
          <Link
            href={`/events/${slug}`}
            className="border border-outline-variant bg-surface hover:bg-surface-variant px-4 py-2 font-label-caps text-label-caps text-on-surface uppercase tracking-widest transition-colors"
          >
            Back to Event
          </Link>
        }
      />

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8">
        <div className="md:hidden mb-6">
          <Link href={`/events/${slug}`} className="font-label-caps text-label-caps text-on-surface-variant hover:text-on-surface uppercase tracking-widest transition-colors">
            ← Back to Event
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {registrations.map(reg => (
            <Link
              href={`/events/${slug}/teams/${reg.id}`}
              key={reg.id}
              className="border border-outline-variant p-4 bg-surface flex justify-between items-center gap-4 hover:bg-surface-variant transition-colors"
            >
              <div className="min-w-0">
                <h3 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface truncate">{reg.team_name}</h3>
                <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">{reg.team_short_name}</p>
              </div>
              <div className="border border-primary-container/50 bg-primary-container/10 text-primary-container text-xs font-bold uppercase tracking-widest px-2 py-1 shrink-0">
                APPROVED
              </div>
            </Link>
          ))}
          {registrations.length === 0 && (
            <div className="col-span-full border border-outline-variant bg-surface p-8 text-center">
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">No teams have been approved yet.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
