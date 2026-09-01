"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold mb-6">Explore Events</h1>
      <div className="grid gap-4">
        {events.map(ev => (
          <Link key={ev.id} href={`/events/${ev.slug || ev.id}`} className="block border p-4 rounded bg-white hover:border-black transition">
            <h2 className="text-xl font-semibold">{ev.name}</h2>
            <p className="text-gray-500 mt-1 line-clamp-2">{ev.description}</p>
            <div className="mt-4">
              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded font-medium">Status: {ev.status}</span>
            </div>
          </Link>
        ))}
        {events.length === 0 && <p className="text-gray-500">No events found.</p>}
      </div>
    </div>
  );
}
