"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TurfHero } from "@/components/shared/TurfHero";

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

  if (loading) return (
    <div className="w-full flex items-center justify-center min-h-[50vh] bg-background">
      <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest animate-pulse">Loading Event...</div>
    </div>
  );
  if (!event) return (
    <div className="w-full flex items-center justify-center min-h-[50vh] bg-background">
      <div className="font-label-caps text-label-caps text-error uppercase tracking-widest">Event not found.</div>
    </div>
  );

  return (
    <div className="w-full bg-background min-h-screen text-on-surface">
      <div className="border-b border-outline-variant bg-surface sticky top-0 z-10">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter h-14 flex items-center">
          <Link href={`/events/${event.slug || event.id}`} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <ChevronLeft size={16} />
            <span className="font-label-caps text-label-caps uppercase tracking-widest">Back to {event.name}</span>
          </Link>
        </div>
      </div>

      <TurfHero
        eyebrow={event.name}
        title={<>Team <span className="text-primary-container">Registration</span></>}
        subtitle="Name your squad and send invites to build your roster."
        image="/turf/aerial-field.jpg"
        size="sm"
      />

      <div className="max-w-[600px] mx-auto px-margin-mobile md:px-gutter py-12 md:py-16">
        {error && (
          <div className="border border-error bg-error/10 p-4 mb-8">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-error block mb-1">Error</span>
            <div className="font-body-md text-error">{error}</div>
          </div>
        )}

        <form onSubmit={handleRegister} className="border border-outline-variant bg-surface p-6 md:p-8 space-y-8">
          <div className="space-y-6">
            <div>
              <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-2">
                Team Name
              </label>
              <input
                required
                type="text"
                className="w-full bg-background border border-outline-variant text-on-surface font-headline-sm uppercase tracking-tighter p-4 focus:outline-none focus:border-primary-container transition-colors placeholder:text-on-surface-variant/50"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="E.G. LOCOFOOT UNITED"
              />
            </div>
            <div>
              <label className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-2">
                Short Name (Optional)
              </label>
              <input
                type="text"
                className="w-full bg-background border border-outline-variant text-on-surface font-headline-sm uppercase tracking-tighter p-4 focus:outline-none focus:border-primary-container transition-colors placeholder:text-on-surface-variant/50"
                value={teamShortName}
                onChange={e => setTeamShortName(e.target.value)}
                placeholder="E.G. LFU"
                maxLength={4}
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={submitting || !teamName.trim()}
            className="w-full bg-primary-container text-on-primary-container hover:bg-primary-container/90 py-4 font-headline-sm uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "CREATING TEAM..." : "CREATE TEAM REGISTRATION"}
          </button>
        </form>
      </div>
    </div>
  );
}

