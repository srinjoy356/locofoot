"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TurfHero } from "@/components/shared/TurfHero";

export default function EventsListPage() {
  const [events, setEvents] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (data) setEvents(data);
    }
    load();
  }, [supabase]);

  return (
    <div className="w-full flex flex-col">
      <TurfHero
        eyebrow="Fixtures & Tournaments"
        title={<>Explore <span className="text-primary-container">Events</span></>}
        subtitle="Browse live fixtures, upcoming tournaments, and open registrations across every arena."
        image="/turf/aerial-goal.jpg"
        size="md"
      />

      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-12">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 opacity-50 text-center">
            <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">stadium</span>
            <h3 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface-variant uppercase tracking-widest">No events found</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map(ev => (
              <Link
                key={ev.id}
                href={`/events/${ev.slug || ev.id}`}
                className="group bg-[#151816] border border-outline-variant p-6 flex flex-col hover:border-primary-container transition-colors"
              >
                <div className="flex justify-between items-start mb-6">
                  <span className="material-symbols-outlined text-primary-container">stadium</span>
                  <span className={`font-label-caps text-label-caps px-2 py-1 uppercase border ${ev.status === 'LIVE' ? 'text-primary-container border-primary-container/30 bg-primary-container/10' : 'text-on-surface-variant border-outline-variant'}`}>
                    {ev.status}
                  </span>
                </div>
                <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface uppercase mb-2 group-hover:text-primary-container transition-colors line-clamp-2">
                  {ev.name}
                </h2>
                {ev.description && (
                  <p className="font-body-md text-on-surface-variant line-clamp-2 mb-6">{ev.description}</p>
                )}
                <div className="mt-auto pt-6 border-t border-outline-variant flex justify-between items-center">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Details</span>
                  <span className="font-label-caps text-label-caps text-primary-container uppercase group-hover:underline">VIEW &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
