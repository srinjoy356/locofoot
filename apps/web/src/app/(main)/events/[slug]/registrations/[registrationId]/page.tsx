"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { TurfHero } from "@/components/shared/TurfHero";

export default function RegistrationManagementPage({ params }: { params: Promise<{ slug: string, registrationId: string }> }) {
  const { slug, registrationId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [event, setEvent] = useState<any>(null);
  const [registration, setRegistration] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteError, setInviteError] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setSessionToken(session.access_token);
      setCurrentUserId(session.user.id);

      // Load event
      let ev = null;
      const { data } = await supabase.from('events').select('*').eq('id', slug).single();
      if (data) ev = data;
      else {
        const { data: bySlug } = await supabase.from('events').select('*').eq('slug', slug).single();
        if (bySlug) ev = bySlug;
      }
      setEvent(ev);

      if (session) {
        // Load registration data
        const { data: reg } = await supabase
          .from('event_team_registrations')
          .select('*')
          .eq('id', registrationId)
          .single();
        setRegistration(reg);

        if (reg) {
          // Load players from the secure backend API which bypasses RLS for users
          const squadRes = await fetch(`/api/v1/events/${ev.id}/registrations/${registrationId}/squad`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          if (squadRes.ok) {
            const squad = await squadRes.json();
            setPlayers(squad || []);
          }
          
          // Load pending invitations
          const invRes = await fetch(`/api/v1/events/${ev.id}/registrations/${registrationId}/invitations`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          if (invRes.ok) {
            const invs = await invRes.json();
            setPendingInvitations(invs || []);
          }
        }
      }

      // Load friends
      const { data: fData, error: fError } = await supabase
        .from('friendships')
        .select(`
          addressee_id,
          requester_id,
          status,
          requester:users!requester_id(id, display_name, unique_code),
          addressee:users!addressee_id(id, display_name, unique_code)
        `)
        .eq('status', 'ACCEPTED')
        .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`);
      
      console.log("Friends Query Result:", fData, fError);
      
      const mappedFriends = (fData || []).map((f: any) => 
        f.requester_id === session.user.id ? f.addressee : f.requester
      );
      setFriends(mappedFriends);

      setLoading(false);
    }
    load();
  }, [slug, registrationId, supabase]);

  async function handleInvite(friendId: string) {
    try {
      setInviteError("");
      const res = await fetch(`/api/v1/events/${event.id}/registrations/${registrationId}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ invited_user_id: friendId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to invite");
      }
      alert("Invitation sent!");
      window.location.reload();
    } catch (err: any) {
      setInviteError(err.message);
    }
  }

  async function handleRemove(playerId: string) {
    if (!confirm("Are you sure you want to remove this player from your squad?")) return;
    
    try {
      const res = await fetch(`/api/v1/events/${event.id}/registrations/${registrationId}/players/${playerId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to remove player");
      }
      alert("Player removed from squad.");
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSubmitRegistration() {
    try {
      const res = await fetch(`/api/v1/events/${event.id}/registrations/${registration.id}/submit`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sessionToken}`
        }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to submit");
      }
      alert("Registration submitted to organizer!");
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) return (
    <div className="w-full flex items-center justify-center min-h-[50vh] bg-background">
      <div className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest animate-pulse">Loading Registration...</div>
    </div>
  );
  if (!registration) return (
    <div className="w-full flex items-center justify-center min-h-[50vh] bg-background">
      <div className="font-label-caps text-label-caps text-error uppercase tracking-widest">Registration not found.</div>
    </div>
  );

  const isCaptain = registration.captain_id === currentUserId;
  const isDraft = registration.status === 'DRAFT';
  const isRosterLocked = registration.roster_locked;

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      <TurfHero
        eyebrow={<span className="flex items-center gap-2">{event?.name}<span className="opacity-40">/</span>Registration</span>}
        title={registration.team_name}
        subtitle="Build your squad, invite friends, and submit to the organizer."
        image="/turf/pitch-lines.jpg"
        size="sm"
      />

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8">
        <Link href={`/events/${event.slug || event.id}`} className="inline-flex items-center gap-2 mb-8 text-on-surface-variant hover:text-on-surface transition-colors font-label-caps text-label-caps uppercase tracking-widest">
          &larr; Back to {event.name}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="border border-outline-variant bg-surface p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface">{registration.team_name}</h2>
                <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mt-2">Status: <span className="text-on-surface">{registration.status}</span></p>
              </div>
              {isCaptain && isDraft && (
                <button onClick={handleSubmitRegistration} className="bg-primary-container text-on-primary-container px-6 py-3 font-label-caps text-label-caps uppercase tracking-widest hover:bg-primary-fixed transition-colors">
                  Submit to Organizer
                </button>
              )}
            </div>

            <div className="border border-outline-variant bg-surface">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface p-6 border-b border-outline-variant bg-surface-container">Squad</h2>
              {players.length === 0 ? (
                <p className="p-6 font-body-md text-on-surface-variant">No players added yet.</p>
              ) : (
                <ul className="divide-y divide-outline-variant">
                  {players.map(p => (
                    <li key={p.id} className="p-4 flex justify-between items-center gap-4 hover:bg-surface-variant transition-colors">
                      <div className="min-w-0">
                        <div className="font-headline-sm uppercase tracking-tighter text-on-surface truncate">{p.users?.display_name || p.users?.username || 'Unknown User'}</div>
                        <div className="font-mono text-xs text-on-surface-variant mt-1">{p.users?.unique_code}</div>
                      </div>
                      <div className="flex gap-2 items-center shrink-0">
                        {p.is_captain_for_event && <span className="border border-primary-container text-primary-container text-[10px] px-2 py-1 font-label-caps uppercase tracking-widest">CAPTAIN</span>}
                        <span className="border border-outline-variant bg-surface-variant text-on-surface-variant text-[10px] px-2 py-1 font-label-caps uppercase tracking-widest">{p.status}</span>
                        {isCaptain && isDraft && !isRosterLocked && !p.is_captain_for_event && (
                          <button
                            onClick={() => handleRemove(p.user_id)}
                            className="text-error hover:text-error/70 text-[10px] px-2 py-1 ml-2 font-label-caps uppercase tracking-widest transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {isCaptain && isDraft && !isRosterLocked && (
            <div className="lg:col-span-1">
              <div className="border border-outline-variant bg-surface p-6 sticky top-6">
                <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface mb-4">Invite Friends</h2>
                {inviteError && <div className="border border-error bg-error/10 text-error font-body-md p-3 mb-4">{inviteError}</div>}
                {friends.length === 0 ? (
                  <p className="font-body-md text-on-surface-variant">You don't have any friends to invite.</p>
                ) : (
                  <ul className="space-y-3">
                    {friends.map(f => {
                      const alreadyInSquad = players.some(p => p.user_id === f.id);
                      const alreadyInvited = pendingInvitations.some(inv => inv.invited_user_id === f.id);
                      return (
                        <li key={f.id} className="flex justify-between items-center gap-2 border-b border-outline-variant pb-3">
                          <div className="font-body-md text-on-surface min-w-0 truncate">{f.display_name || f.username || 'Unknown User'}</div>
                          <button
                            disabled={alreadyInSquad || alreadyInvited}
                            onClick={() => handleInvite(f.id)}
                            className={`px-3 py-1.5 font-label-caps text-[10px] uppercase tracking-widest transition-colors shrink-0 ${(alreadyInSquad || alreadyInvited) ? 'border border-outline-variant text-on-surface-variant opacity-50 cursor-not-allowed' : 'bg-primary-container text-on-primary-container hover:bg-primary-fixed'}`}
                          >
                            {alreadyInSquad ? 'Added' : (alreadyInvited ? 'Invited' : 'Invite')}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
