"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TurfHero } from "@/components/shared/TurfHero";

export default function CreateEventPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Not authenticated.");
      setSubmitting(false);
      return;
    }
    
    try {
      const res = await fetch("/api/v1/events", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ name, description })
      });
      
      if (res.ok) {
        const event = await res.json();
        router.push(`/admin/events/${event.id}`);
      } else {
        const errorData = await res.json();
        setError(errorData.detail || "Failed to create event");
      }
    } catch (err: any) {
      setError("Network error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full flex flex-col bg-background min-h-screen text-on-surface pb-12">
      <TurfHero
        eyebrow="Organizer"
        title={<>Create <span className="text-primary-container">Event</span></>}
        subtitle="Set up a new tournament or competition."
        image="/turf/turf-closeup.jpg"
        size="sm"
      />
      <div className="w-full max-w-[600px] mx-auto px-margin-mobile md:px-gutter py-8 md:py-12">

        {error && (
          <div className="border border-error bg-error/10 p-4 mb-8">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-error block mb-1">Error</span>
            <div className="font-body-md text-error">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="border border-outline-variant bg-surface p-6 md:p-8 space-y-8">
          <div className="space-y-6">
            <div>
              <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-2">Name</label>
              <input 
                required 
                className="w-full bg-background border border-outline-variant text-on-surface font-headline-sm uppercase tracking-tighter p-4 rounded-none focus:outline-none focus:border-primary-container transition-colors placeholder:text-on-surface-variant/50" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="E.G. LOCOFOOT CHAMPIONS LEAGUE"
              />
            </div>
            <div>
              <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-2">Description</label>
              <textarea 
                required 
                className="w-full bg-background border border-outline-variant text-on-surface font-body-md p-4 rounded-none focus:outline-none focus:border-primary-container transition-colors resize-none placeholder:text-on-surface-variant/50" 
                rows={4} 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="EVENT DETAILS..."
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={submitting || !name.trim()}
            className="w-full bg-primary-container text-on-primary-container hover:bg-primary-container/90 py-4 font-headline-sm uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "CREATING..." : "CREATE EVENT"}
          </button>
        </form>
      </div>
    </div>
  );
}
