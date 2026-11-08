"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TurfHero } from "@/components/shared/TurfHero";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [matchInfo, setMatchInfo] = useState<Record<string, { label: string; assigned: boolean }>>({});
  // Inline message rather than alert(), which embedded and in-app browsers block.
  const [notice, setNotice] = useState("");
  const supabase = createClient();

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // Using Supabase direct fetch for notifications since they are standard Phase 1
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
      
    if (data) {
      setNotifications(data);
      // name the team on each invitation
      const regIds = [...new Set(data.filter((n: any) => n.type === 'PLAYER_INVITED').map((n: any) => n.payload?.registration_id).filter(Boolean))];
      if (regIds.length) {
        const { data: regs } = await supabase.from('event_team_registrations').select('id, team_name').in('id', regIds as string[]);
        setTeamNames(Object.fromEntries((regs || []).map((r: any) => [r.id, r.team_name])));
      }

      // say which match a referee assignment is for, and whether it still stands
      const matchIds = [...new Set(data.filter((n: any) => n.type === 'REFEREE_ASSIGNED').map((n: any) => n.payload?.match_id).filter(Boolean))] as string[];
      if (matchIds.length) {
        const [{ data: ms }, { data: mine }] = await Promise.all([
          supabase.from('matches').select('id, scheduled_start, home_registration_id, away_registration_id, venue_field_id').in('id', matchIds),
          supabase.from('match_referees').select('match_id').eq('user_id', session.user.id).in('match_id', matchIds),
        ]);
        const teamIds = [...new Set((ms || []).flatMap((m: any) => [m.home_registration_id, m.away_registration_id]).filter(Boolean))] as string[];
        const fieldIds = [...new Set((ms || []).map((m: any) => m.venue_field_id).filter(Boolean))] as string[];
        const [{ data: teams }, { data: fields }] = await Promise.all([
          teamIds.length ? supabase.from('event_team_registrations').select('id, team_name').in('id', teamIds) : Promise.resolve({ data: [] as any[] }),
          fieldIds.length ? supabase.from('venue_fields').select('id, name').in('id', fieldIds) : Promise.resolve({ data: [] as any[] }),
        ]);
        const team = Object.fromEntries((teams || []).map((t: any) => [t.id, t.team_name]));
        const field = Object.fromEntries((fields || []).map((f: any) => [f.id, f.name]));
        const stillAssigned = new Set((mine || []).map((r: any) => r.match_id));
        setMatchInfo(Object.fromEntries((ms || []).map((m: any) => [m.id, {
          label: `${team[m.home_registration_id] || 'TBD'} vs ${team[m.away_registration_id] || 'TBD'}${m.scheduled_start ? ` at ${new Date(m.scheduled_start).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}${field[m.venue_field_id] ? `, ${field[m.venue_field_id]}` : ''}`,
          assigned: stillAssigned.has(m.id),
        }])));
      }
    }
  }

  useEffect(() => { load(); }, [supabase]);

  async function acceptRefereeAssignment(matchId: string, notifId: string) {
    if (processingIds.has(notifId)) return;
    setProcessingIds(prev => new Set(prev).add(notifId));
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      // Update match_referees status
      const { error } = await supabase
        .from('match_referees')
        .update({ status: 'ACCEPTED', responded_at: new Date().toISOString() })
        .eq('match_id', matchId)
        .eq('user_id', session.user.id);
        
      if (error) {
        setNotice("Failed to accept assignment: " + error.message);
        return;
      }
      
      // mark notification as read
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notifId);
      await load();
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(notifId);
        return next;
      });
    }
  }

  async function respondToInvite(eventId: string, regId: string, invId: string, notifId: string, status: "ACCEPTED" | "DECLINED" = "ACCEPTED") {
    if (processingIds.has(notifId)) return;
    setProcessingIds(prev => new Set(prev).add(notifId));
    setNotice("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/v1/events/${eventId}/registrations/${regId}/invitations/${invId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ status })
      });
      
      if (res.ok) {
        // mark notification as read
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notifId);
        await load();
      } else {
        const err = await res.json();
        // If it was already accepted in a concurrent request, treat as success visually
        if (err.message === 'Invitation is no longer pending' || err.code === 'P0001') {
           await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notifId);
           await load();
        } else {
           setNotice(`Could not ${status === "ACCEPTED" ? "accept" : "decline"} the invitation: ${err.detail || "please try again"}`);
        }
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(notifId);
        return next;
      });
    }
  }

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen pb-12">
      {/* Header */}
      <TurfHero
        eyebrow="Activity Feed"
        title="Notifications"
        subtitle="Invites, referee assignments, and match updates in one place."
        image="/turf/aerial-field.jpg"
        size="sm"
      />

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8">
        {notice && <div role="alert" className="mb-4 border border-error bg-error/10 text-error font-body-md p-3">{notice}</div>}
        <div className="border border-outline-variant bg-surface">
          <ul className="grid grid-cols-1 divide-y divide-outline-variant">
            {notifications.map(n => (
              <li key={n.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 gap-6 transition-colors ${n.read_at ? 'bg-surface hover:bg-surface-variant opacity-75' : 'bg-background hover:bg-surface-variant border-l-2 border-l-primary-container'}`}>
                <div className="flex-1">
                  <p className="font-headline-sm uppercase text-on-surface leading-tight">
                    {n.type === 'PLAYER_INVITED' && `🔔 Team invitation to join ${teamNames[n.payload?.registration_id] || 'a team'}`}
                    {n.type === 'REFEREE_ASSIGNED' && (matchInfo[n.payload?.match_id]
                      ? (matchInfo[n.payload.match_id].assigned ? `⚽ You are officiating ${matchInfo[n.payload.match_id].label}` : `⚽ Withdrawn: ${matchInfo[n.payload.match_id].label}`)
                      : `⚽ You have been assigned to officiate a match!`)}
                    {n.type === 'EVENT_REFEREE_ASSIGNED' && `⚽ You have been assigned as a Tournament Referee!`}
                    {n.type === 'REFEREE_ACCEPTED' && `✅ Referee assignment accepted.`}
                    {n.type === 'FRIEND_REQUEST' && `👋 You have a new friend request!`}
                    {n.type === 'FRIEND_ACCEPTED' && `🎉 Your friend request was accepted!`}
                    {n.type === 'ROSTER_INCOMPLETE' && `⚠️ Your team roster is incomplete. Please add more players.`}
                    {n.type === 'MATCH_STARTING_SOON' && `⏰ Your match is starting soon!`}
                    {n.type === 'MATCH_CHANGED' && `📅 The schedule for your match has been updated.`}
                    {n.type === 'TEAM_REGISTRATION_APPROVED' && `✅ Your team registration has been approved!`}
                    {n.type === 'TOURNAMENT_COMPLETED' && `🏆 The tournament has concluded. Thanks for playing!`}
                    {n.type === 'TEAM_ROSTER_LOCKED' && `🔒 Your team roster has been locked by the organizer.`}
                    {n.type === 'DM_RECEIVED' && `💬 You received a new direct message.`}
                    {!['PLAYER_INVITED', 'REFEREE_ASSIGNED', 'REFEREE_ACCEPTED', 'EVENT_REFEREE_ASSIGNED', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'ROSTER_INCOMPLETE', 'MATCH_STARTING_SOON', 'MATCH_CHANGED', 'TEAM_REGISTRATION_APPROVED', 'TOURNAMENT_COMPLETED', 'TEAM_ROSTER_LOCKED', 'DM_RECEIVED'].includes(n.type) && `Notification: ${n.type}`}
                  </p>
                  <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mt-2">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                  {n.type === 'PLAYER_INVITED' && !n.read_at && (
                    <>
                      <button
                        onClick={() => respondToInvite(n.payload.event_id, n.payload.registration_id, n.payload.invitation_id, n.id)}
                        disabled={processingIds.has(n.id)}
                        className="flex-1 sm:flex-none border border-primary-container bg-primary-container/10 hover:bg-primary-container/20 text-primary-container px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {processingIds.has(n.id) ? 'PROCESSING...' : 'Accept Invite'}
                      </button>
                      <button
                        onClick={() => respondToInvite(n.payload.event_id, n.payload.registration_id, n.payload.invitation_id, n.id, "DECLINED")}
                        disabled={processingIds.has(n.id)}
                        className="flex-1 sm:flex-none border border-outline-variant bg-surface hover:border-error hover:text-error text-on-surface-variant px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Decline
                      </button>
                    </>
                  )}
                  {n.type === 'REFEREE_ASSIGNED' && !n.read_at && matchInfo[n.payload?.match_id]?.assigned !== false && (
                    <button 
                      onClick={() => acceptRefereeAssignment(n.payload.match_id, n.id)} 
                      disabled={processingIds.has(n.id)}
                      className="flex-1 sm:flex-none border border-[#eab308] bg-[#eab308]/10 hover:bg-[#eab308]/20 text-[#eab308] px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {processingIds.has(n.id) ? 'PROCESSING...' : 'Accept Match'}
                    </button>
                  )}
                  {n.type === 'EVENT_REFEREE_ASSIGNED' && !n.read_at && (
                    <button onClick={async () => {
                      if (processingIds.has(n.id)) return;
                      setProcessingIds(prev => new Set(prev).add(n.id));
                      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
                      await load();
                      setProcessingIds(prev => {
                        const next = new Set(prev);
                        next.delete(n.id);
                        return next;
                      });
                    }} disabled={processingIds.has(n.id)} className="flex-1 sm:flex-none border border-[#eab308] bg-[#eab308]/10 hover:bg-[#eab308]/20 text-[#eab308] px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {processingIds.has(n.id) ? 'PROCESSING...' : 'Acknowledge'}
                    </button>
                  )}
                  {n.type === 'FRIEND_REQUEST' && !n.read_at && (
                    <button onClick={async () => {
                      if (processingIds.has(n.id)) return;
                      setProcessingIds(prev => new Set(prev).add(n.id));
                      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
                      window.location.href = '/friends';
                    }} disabled={processingIds.has(n.id)} className="flex-1 sm:flex-none border border-primary-container bg-primary-container/10 hover:bg-primary-container/20 text-primary-container px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {processingIds.has(n.id) ? 'PROCESSING...' : 'View Request'}
                    </button>
                  )}
                  {(!['PLAYER_INVITED', 'REFEREE_ASSIGNED', 'EVENT_REFEREE_ASSIGNED', 'FRIEND_REQUEST'].includes(n.type) || (n.type === 'REFEREE_ASSIGNED' && matchInfo[n.payload?.match_id]?.assigned === false)) && !n.read_at && (
                    <button onClick={async () => {
                      if (processingIds.has(n.id)) return;
                      setProcessingIds(prev => new Set(prev).add(n.id));
                      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
                      await load();
                      setProcessingIds(prev => {
                        const next = new Set(prev);
                        next.delete(n.id);
                        return next;
                      });
                    }} disabled={processingIds.has(n.id)} className="flex-1 sm:flex-none border border-outline-variant bg-surface hover:border-on-surface hover:text-on-surface text-on-surface-variant px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {processingIds.has(n.id) ? 'DISMISSING...' : 'Dismiss'}
                    </button>
                  )}
                </div>
              </li>
            ))}
            {notifications.length === 0 && (
              <li className="p-6 font-body-md text-on-surface-variant">No notifications.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
