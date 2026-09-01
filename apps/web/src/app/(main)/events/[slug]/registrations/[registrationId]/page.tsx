"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

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

  if (loading) return <div>Loading...</div>;
  if (!registration) return <div>Registration not found.</div>;

  const isCaptain = registration.captain_id === currentUserId;
  const isDraft = registration.status === 'DRAFT';
  const isRosterLocked = registration.roster_locked;

  return (
    <div className="max-w-4xl mx-auto py-8 grid grid-cols-3 gap-8">
      <div className="col-span-2 space-y-6">
        <Link href={`/events/${event.slug || event.id}`} className="text-blue-600 hover:underline mb-4 inline-block">
          &larr; Back to {event.name}
        </Link>
        
        <div className="bg-white p-6 rounded border flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{registration.team_name}</h1>
            <p className="text-gray-500 text-sm">Status: <span className="font-semibold text-black">{registration.status}</span></p>
          </div>
          {isCaptain && isDraft && (
            <button onClick={handleSubmitRegistration} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium">
              Submit to Organizer
            </button>
          )}
        </div>

        <div className="bg-white p-6 rounded border space-y-4">
          <h2 className="text-xl font-bold">Squad</h2>
          {players.length === 0 ? (
            <p className="text-gray-500 text-sm">No players added yet.</p>
          ) : (
            <ul className="divide-y border rounded">
              {players.map(p => (
                <li key={p.id} className="p-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{p.users?.display_name || p.users?.username || 'Unknown User'}</div>
                    <div className="text-xs text-gray-500 font-mono">{p.users?.unique_code}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {p.is_captain_for_event && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">CAPTAIN</span>}
                    <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">{p.status}</span>
                    {isCaptain && isDraft && !isRosterLocked && !p.is_captain_for_event && (
                      <button 
                        onClick={() => handleRemove(p.user_id)} 
                        className="text-red-500 hover:text-red-700 text-xs px-2 py-1 ml-2"
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
        <div className="col-span-1">
          <div className="bg-white p-6 rounded border sticky top-20">
            <h2 className="font-bold mb-4">Invite Friends</h2>
            {inviteError && <div className="text-red-600 text-sm mb-4">{inviteError}</div>}
            {friends.length === 0 ? (
              <p className="text-gray-500 text-sm">You don't have any friends to invite.</p>
            ) : (
              <ul className="space-y-3">
                {friends.map(f => {
                  const alreadyInSquad = players.some(p => p.user_id === f.id);
                  const alreadyInvited = pendingInvitations.some(inv => inv.invited_user_id === f.id);
                  return (
                    <li key={f.id} className="flex justify-between items-center text-sm border-b pb-2">
                      <div>
                        <div className="font-medium">{f.display_name || f.username || 'Unknown User'}</div>
                      </div>
                      <button 
                        disabled={alreadyInSquad || alreadyInvited}
                        onClick={() => handleInvite(f.id)}
                        className={`px-3 py-1 rounded text-xs ${(alreadyInSquad || alreadyInvited) ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800'}`}
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
  );
}
