"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Plus, Edit } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Manage Events</h1>
        <Link href="/admin/events/create" className="bg-black text-white px-4 py-2 rounded flex items-center gap-2">
          <Plus size={16} /> Create Event
        </Link>
      </div>

      <div className="grid gap-4">
        {events.map((e) => (
          <div key={e.id} className="border p-4 rounded bg-white flex justify-between items-center">
            <div>
              <h3 className="font-bold">{e.name}</h3>
              <p className="text-sm text-gray-500">{e.status} • {e.format}</p>
            </div>
            <Link href={`/admin/events/${e.id}`} className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200 flex items-center gap-1">
              <Edit size={14} /> Manage
            </Link>
          </div>
        ))}
        {events.length === 0 && <p className="text-gray-500 py-4">No events found.</p>}
      </div>
    </div>
  );
}
