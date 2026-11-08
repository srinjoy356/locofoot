"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function AdminEventRegistrationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const supabase = createClient();

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/v1/events/${eventId}/registrations`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setRegistrations(data);
    }
  }

  useEffect(() => { loadData(); }, [eventId, supabase]);

  // Inline errors rather than alert(), which embedded and in-app browsers block.
  const [error, setError] = useState("");

  // a rejected seed is shown next to its own box, and the box is reset, instead of at the top of a long page
  const [seedError, setSeedError] = useState<{ id: string; text: string } | null>(null);
  const [resetKey, setResetKey] = useState(0);

  async function act(path: string, method: string, body?: unknown): Promise<string | null> {
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/v1/events/${eventId}/registrations/${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (res.ok) { loadData(); return null; }
    const data = await res.json().catch(() => ({}));
    const text = typeof data.detail === "string" ? data.detail : "That did not work. Please try again.";
    loadData();
    return text;
  }

  const report = async (p: Promise<string | null>) => { const text = await p; if (text) setError(text); };
  const changeStatus = (regId: string, status: string) => report(act(`${regId}/status`, "PUT", { status }));
  const unlockRoster = (regId: string) => report(act(`${regId}/unlock`, "POST"));
  const lockRoster = (regId: string) => report(act(`${regId}/lock`, "POST"));
  const setSeed = async (regId: string, value: string) => {
    setSeedError(null);
    const text = await act(`${regId}/seed`, "PUT", { seed: value === "" ? null : Number(value) });
    if (text) { setSeedError({ id: regId, text }); setResetKey(k => k + 1); }
  };

  return (
    <div className="w-full bg-background min-h-[calc(100vh-64px)] text-on-surface">
      {/* Top Bar */}
      <div className="border-b border-outline-variant bg-surface sticky top-0 z-10">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter h-14 flex items-center justify-between">
          <Link href={`/admin/events/${eventId}`} className="flex items-center gap-2 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors">← Back to Event</Link>
        </div>
      </div>

      <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-12">
        <div className="relative overflow-hidden border border-outline-variant bg-[#151816]">
          <div className="absolute inset-0 z-0">
            <img alt="" aria-hidden="true" className="w-full h-full object-cover object-center  opacity-25 " src="/turf/aerial-field.jpg" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40 z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
          </div>
          <div className="relative z-20 p-6 md:p-8">
            <span className="mb-3 block font-label-caps text-label-caps text-primary-container uppercase tracking-widest">
              Event Operations
            </span>
            <h1 className="font-display-lg text-display-lg md:text-[56px] uppercase tracking-tighter leading-none text-on-surface">
              Team Registrations
            </h1>
            <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mt-4 max-w-xl">
              Review team submissions, approve entries, and manage roster locks.
            </p>
          </div>
        </div>

        {error && <div role="alert" className="border border-error bg-error/10 text-error font-body-md p-3">{error}</div>}

        <div className="grid gap-6">
          {registrations.map(reg => (
            <div key={reg.id} className="border border-outline-variant bg-surface p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                  <h3 className="font-headline-sm uppercase tracking-tighter text-on-surface">{reg.team_name}</h3>
                  <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">Status: <span className="text-on-surface">{reg.status}</span> {reg.roster_locked && '🔒 (Locked)'}</p>
                  <label className="flex items-center gap-2 mt-2 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Seed (1 = strongest)
                    <input
                      type="number" min={1} max={64} defaultValue={reg.seed ?? ""} key={`${reg.id}-${reg.seed ?? ""}-${resetKey}`}
                      onBlur={e => { if (e.target.value !== String(reg.seed ?? "")) setSeed(reg.id, e.target.value); }}
                      className="w-20 p-1.5 bg-background border border-outline-variant focus:outline-none focus:border-primary-container text-on-surface font-mono"
                    />
                  </label>
                  {seedError && seedError.id === reg.id && <p role="alert" className="mt-1 font-body-md text-error normal-case tracking-normal">{seedError.text}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(reg.status === 'PENDING_APPROVAL' || reg.status === 'APPROVED') && (
                    <button onClick={() => changeStatus(reg.id, 'DRAFT')} className="border border-outline-variant bg-surface-variant text-on-surface px-3 py-1.5 font-label-caps text-[10px] uppercase tracking-widest hover:bg-surface-container-highest transition-colors">Revert to Draft</button>
                  )}
                  {reg.status === 'PENDING_APPROVAL' && (
                    <button onClick={() => changeStatus(reg.id, 'APPROVED')} className="bg-primary-container text-on-primary-container px-3 py-1.5 font-label-caps text-[10px] uppercase tracking-widest hover:bg-primary-fixed transition-colors">Approve</button>
                  )}
                  {!reg.roster_locked && (
                    <button onClick={() => lockRoster(reg.id)} className="bg-error text-on-error px-3 py-1.5 font-label-caps text-[10px] uppercase tracking-widest hover:bg-error/90 transition-colors">Lock Roster</button>
                  )}
                  {reg.roster_locked && (
                    <button onClick={() => unlockRoster(reg.id)} className="border border-error text-error px-3 py-1.5 font-label-caps text-[10px] uppercase tracking-widest hover:bg-error/10 transition-colors">Unlock Roster</button>
                  )}
                </div>
              </div>

              <div className="border border-outline-variant bg-background p-4">
                <h4 className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">Roster ({reg.players?.length || 0} players)</h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {reg.players?.map((p: any) => (
                    <li key={p.id} className="flex gap-2 items-center font-body-sm text-on-surface">
                      <span className="w-8 text-center shrink-0 bg-surface-variant border border-outline-variant text-on-surface-variant font-mono text-xs py-0.5">{p.jersey_number || '-'}</span>
                      <span className="text-on-surface truncate">{p.user?.display_name || p.user?.email || p.guest_name}</span>
                      {p.is_captain_for_event && <span className="border border-primary-container text-primary-container text-[10px] px-1 font-label-caps uppercase tracking-widest">C</span>}
                      {p.is_vice_captain_for_event &&<span className="border border-outline-variant text-on-surface-variant text-[10px] px-1 font-label-caps uppercase tracking-widest">VC</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
          {registrations.length === 0 && <p className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">No registrations found.</p>}
        </div>
      </div>
    </div>
  );
}
