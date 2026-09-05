"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TurfHero } from "@/components/shared/TurfHero";

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
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      <TurfHero
        eyebrow="Organizer"
        title={<>Venues & <span className="text-primary-container">Fields</span></>}
        subtitle="Manage your venues and their playing fields."
        image="/turf/aerial-goal.jpg"
        size="sm"
      />

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-8">
        <form onSubmit={createVenue} className="flex flex-col sm:flex-row gap-3">
          <input
            required
            placeholder="VENUE NAME"
            className="flex-1 p-4 bg-background border border-outline-variant focus:outline-none focus:border-primary-container font-body-md text-on-surface transition-colors"
            value={newVenueName}
            onChange={e => setNewVenueName(e.target.value)}
          />
          <button className="bg-primary-container text-on-primary-container px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors whitespace-nowrap">
            Create Venue
          </button>
        </form>

        <div className="grid gap-6">
          {venues.map(v => (
            <div key={v.id} className="border border-outline-variant p-6 bg-surface">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface mb-4">{v.name}</h2>

              <div className="space-y-2 mb-4">
                {v.fields?.map((f: any) => (
                  <div key={f.id} className="flex gap-3 items-center bg-background border border-outline-variant p-3">
                    <span className="material-symbols-outlined text-on-surface-variant text-base">grass</span>
                    <span className="font-body-md text-on-surface">{f.name}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => {
                const fName = prompt("Field name:");
                if (fName) createField(v.id, fName);
              }} className="border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface px-4 py-2 font-label-caps text-label-caps uppercase tracking-widest transition-colors">
                Add Field
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
