"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function EventRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [teamShortName, setTeamShortName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      // For this demo, let's look up by id first
      const { data } = await supabase.from('events').select('*').eq('id', slug).single();
      if (data) setEvent(data);
      else {
        const { data: bySlug } = await supabase.from('events').select('*').eq('slug', slug).single();
        if (bySlug) setEvent(bySlug);
      }
      setLoading(false);
    }
    load();
  }, [slug, supabase]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("You must be logged in to register.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/v1/events/${event.id}/registrations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          team_name: teamName,
          team_short_name: teamShortName || undefined
        })
      });

      if (!res.ok) {
        let errorMsg = "Failed to register";
        try {
          const errorData = await res.json();
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          errorMsg = await res.text() || res.statusText;
        }
        throw new Error(errorMsg);
      }

      const regData = await res.json();
      router.push(`/events/${event.slug || event.id}/registrations/${regData.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (!event) return <div>Event not found.</div>;

  return (
    <div className="max-w-xl mx-auto py-8">
      <Link href={`/events/${event.slug || event.id}`} className="text-blue-600 hover:underline mb-4 inline-block">
        &larr; Back to {event.name}
      </Link>
      <h1 className="text-2xl font-bold mb-6">Register a Team for {event.name}</h1>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 text-red-600 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4 bg-white dark:bg-zinc-900 p-6 rounded border">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Team Name</label>
          <input
            required
            type="text"
            className="w-full border p-2 rounded"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="E.g. LocoFoot United"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Short Name (Optional)</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            value={teamShortName}
            onChange={e => setTeamShortName(e.target.value)}
            placeholder="E.g. LFU"
          />
        </div>
        
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Team Registration"}
        </button>
      </form>
    </div>
  );
}
