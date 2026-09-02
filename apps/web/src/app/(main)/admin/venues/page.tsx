"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function VenuesPage() {
  const [venues, setVenues] = useState<any[]>([]);
  const [newVenueName, setNewVenueName] = useState("");
  const supabase = createClient();

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: vData } = await supabase.from('venues').select('*, fields(*)').order('created_at', { ascending: false });
    if (vData) setVenues(vData);
  }

  useEffect(() => { load(); }, [supabase]);

  async function createVenue(e: React.FormEvent) {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/v1/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ name: newVenueName })
    });
    setNewVenueName("");
    load();
  }

  async function createField(venueId: string, name: string) {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`/api/v1/venues/${venueId}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ name, field_type: "GRASS", length: 100, width: 50 })
    });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Venues</h1>
      
      <form onSubmit={createVenue} className="flex gap-2 mb-6">
        <input required placeholder="Venue Name" className="border p-2 rounded" value={newVenueName} onChange={e => setNewVenueName(e.target.value)} />
        <button className="bg-black text-white px-4 rounded">Create Venue</button>
      </form>

      <div className="grid gap-6">
        {venues.map(v => (
          <div key={v.id} className="border p-4 rounded bg-white dark:bg-zinc-900">
            <h2 className="font-bold text-lg mb-4">{v.name}</h2>
            
            <div className="space-y-2 mb-4">
              {v.fields?.map((f: any) => (
                <div key={f.id} className="flex gap-2 items-center bg-slate-50 dark:bg-zinc-900/50 p-2 rounded">
                  <span>{f.name}</span>
                </div>
              ))}
            </div>

            <button onClick={() => {
              const fName = prompt("Field name:");
              if (fName) createField(v.id, fName);
            }} className="text-sm bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded">Add Field</button>
          </div>
        ))}
      </div>
    </div>
  );
}
