"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

  if (!event) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/events/${slug}`} className="text-gray-500 hover:text-black">← Back to Event</Link>
        <h1 className="text-2xl font-bold">{event.name} - Participating Teams</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {registrations.map(reg => (
          <div key={reg.id} className="border p-4 rounded bg-white flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">{reg.team_name}</h3>
              <p className="text-gray-500">{reg.team_short_name}</p>
            </div>
            <div className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">
              APPROVED
            </div>
          </div>
        ))}
        {registrations.length === 0 && <p className="text-gray-500 col-span-2">No teams have been approved yet.</p>}
      </div>
    </div>
  );
}
