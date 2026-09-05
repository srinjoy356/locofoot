"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Plus, Edit } from "lucide-react";
import { TurfHero } from "@/components/shared/TurfHero";

export default function AdminEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Find events where user is EVENT_OWNER
      const { data: roles } = await supabase.from('event_roles')
        .select('event_id')
        .eq('user_id', session.user.id)
        .eq('role', 'EVENT_OWNER');
      
      if (roles && roles.length > 0) {
        const eventIds = roles.map(r => r.event_id);
        const { data: eventsData } = await supabase.from('events').select('*').in('id', eventIds).order('created_at', { ascending: false });
        if (eventsData) setEvents(eventsData);
      }
    }
    load();
  }, [supabase]);

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      <TurfHero
        eyebrow="Organizer"
        title={<>Manage <span className="text-primary-container">Events</span></>}
        subtitle="Your tournaments and competitions in one place."
        image="/turf/stadium.jpg"
        size="sm"
        actions={
          <Link href="/admin/events/create" className="bg-primary-container text-on-primary-container px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors flex items-center gap-2">
            <Plus size={16} /> Create Event
          </Link>
        }
      />

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-6">
        {/* Mobile create action (hero actions are desktop-only) */}
        <Link href="/admin/events/create" className="md:hidden bg-primary-container text-on-primary-container px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors flex items-center justify-center gap-2">
          <Plus size={16} /> Create Event
        </Link>

        <div className="grid gap-4">
          {events.map((e) => (
            <div key={e.id} className="border border-outline-variant p-4 bg-surface hover:bg-surface-variant transition-colors flex justify-between items-center gap-4">
              <div className="min-w-0">
                <h3 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface truncate">{e.name}</h3>
                <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mt-1">{e.status} • {e.format}</p>
              </div>
              <Link href={`/admin/events/${e.id}`} className="border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface px-4 py-2 font-label-caps text-label-caps uppercase tracking-widest transition-colors flex items-center gap-2 shrink-0">
                <Edit size={14} /> Manage
              </Link>
            </div>
          ))}
          {events.length === 0 && <p className="font-body-md text-on-surface-variant py-4">No events found.</p>}
        </div>
      </div>
    </div>
  );
}
