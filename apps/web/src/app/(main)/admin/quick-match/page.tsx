"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Plus, Bolt, Trash2 } from "lucide-react";
import { TurfHero } from "@/components/shared/TurfHero";

export default function AdminQuickMatchDashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: eventsData } = await supabase
        .from('events')
        .select(`
          id, 
          name, 
          created_at, 
          status,
          matches ( id, status )
        `)
        .eq('type', 'QUICK_MATCH')
        .eq('organizer_id', session.user.id)
        .order('created_at', { ascending: false });
        
      if (eventsData) setEvents(eventsData);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const handleDelete = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this match? This cannot be undone.")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/v1/quick-match/${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        }
      });
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== eventId));
      } else {
        alert("Failed to delete match");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting match");
    }
  };

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      <TurfHero
        eyebrow="Organizer"
        title={<>Quick <span className="text-primary-container">Matches</span></>}
        subtitle="Manage and review your instant pickup matches."
        image="/turf/stadium.jpg"
        size="sm"
        actions={
          <Link href="/admin/quick-match/new" className="bg-primary-container text-on-primary-container px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors flex items-center gap-2">
            <Plus size={16} /> New Match
          </Link>
        }
      />

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-6">
        {/* Mobile create action */}
        <Link href="/admin/quick-match/new" className="md:hidden bg-primary-container text-on-primary-container px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors flex items-center justify-center gap-2">
          <Plus size={16} /> New Match
        </Link>

        {loading ? (
          <p className="font-body-md text-on-surface-variant py-4">Loading quick matches...</p>
        ) : (
          <div className="grid gap-4">
            {events.map((e) => {
              const matchId = e.matches?.[0]?.id;
              const matchStatus = e.matches?.[0]?.status || 'UNKNOWN';
              
              return (
                <div key={e.id} className="border border-outline-variant p-4 bg-surface hover:bg-surface-variant transition-colors flex justify-between items-center gap-4">
                  <div className="min-w-0 flex items-center gap-4">
                    <span className="w-10 h-10 bg-primary-container/20 flex items-center justify-center text-primary-container shrink-0 rounded-full">
                      <Bolt size={20} />
                    </span>
                    <div>
                      <h3 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface truncate">{e.name}</h3>
                      <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mt-1">Status: {matchStatus} • {new Date(e.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                    {matchId && (
                      <Link href={`/events/${e.id}/matches/${matchId}`} className="bg-primary-container hover:bg-primary-fixed text-on-primary-container px-4 py-2 font-label-caps text-label-caps uppercase tracking-widest transition-colors flex items-center gap-2">
                        View Match
                      </Link>
                    )}
                    <button onClick={() => handleDelete(e.id)} className="border border-outline-variant bg-surface hover:bg-error/10 text-error px-4 py-2 font-label-caps text-label-caps uppercase tracking-widest transition-colors flex items-center gap-2 shrink-0" title="Delete Match">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            {events.length === 0 && (
              <div className="text-center py-12 bg-surface-container border border-outline-variant">
                <span className="w-16 h-16 bg-surface-variant flex items-center justify-center text-on-surface-variant rounded-full mx-auto mb-4">
                  <Bolt size={32} />
                </span>
                <h3 className="font-display text-xl uppercase tracking-widest text-on-surface mb-2">No Quick Matches</h3>
                <p className="text-on-surface-variant mb-6 max-w-md mx-auto">You haven't created any quick pickup matches yet.</p>
                <Link href="/admin/quick-match/new" className="bg-primary-container text-on-primary-container px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest inline-flex items-center gap-2">
                  <Plus size={16} /> Start One Now
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
