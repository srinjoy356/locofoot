"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TurfHero } from "@/components/shared/TurfHero";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
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
      
    if (data) setNotifications(data);
  }

  useEffect(() => { load(); }, [supabase]);

  async function acceptRefereeAssignment(matchId: string, notifId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // Update match_referees status
    const { error } = await supabase
      .from('match_referees')
      .update({ status: 'ACCEPTED', responded_at: new Date().toISOString() })
      .eq('match_id', matchId)
      .eq('user_id', session.user.id);
      
    if (error) {
      alert("Failed to accept assignment: " + error.message);
      return;
    }
    
    // mark notification as read
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notifId);
    load();
  }

  async function acceptInvite(eventId: string, regId: string, invId: string, notifId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/v1/events/${eventId}/registrations/${regId}/invitations/${invId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ status: "ACCEPTED" })
    });
    
    if (res.ok) {
      // mark notification as read
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notifId);
      load();
    } else {
      const err = await res.json();
      alert("Failed to accept: " + (err.detail || JSON.stringify(err)));
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
        <div className="border border-outline-variant bg-surface">
          <ul className="grid grid-cols-1 divide-y divide-outline-variant">
            {notifications.map(n => (
              <li key={n.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 gap-6 transition-colors ${n.read_at ? 'bg-surface hover:bg-surface-variant opacity-75' : 'bg-background hover:bg-surface-variant border-l-2 border-l-primary-container'}`}>
                <div className="flex-1">
                  <p className="font-headline-sm uppercase text-on-surface leading-tight">
                    {n.type === 'PLAYER_INVITED' && `🔔 Team invitation to join team`}
                    {n.type === 'REFEREE_ASSIGNED' && `⚽ You have been assigned to officiate a match!`}
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
                    <button onClick={() => acceptInvite(n.payload.event_id, n.payload.registration_id, n.payload.invitation_id, n.id)} className="flex-1 sm:flex-none border border-primary-container bg-primary-container/10 hover:bg-primary-container/20 text-primary-container px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                      Accept Invite
                    </button>
                  )}
                  {n.type === 'REFEREE_ASSIGNED' && !n.read_at && (
                    <button onClick={() => acceptRefereeAssignment(n.payload.match_id, n.id)} className="flex-1 sm:flex-none border border-[#eab308] bg-[#eab308]/10 hover:bg-[#eab308]/20 text-[#eab308] px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                      Accept Match
                    </button>
                  )}
                  {n.type === 'EVENT_REFEREE_ASSIGNED' && !n.read_at && (
                    <button onClick={async () => {
                      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
                      load();
                    }} className="flex-1 sm:flex-none border border-[#eab308] bg-[#eab308]/10 hover:bg-[#eab308]/20 text-[#eab308] px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                      Acknowledge
                    </button>
                  )}
                  {n.type === 'FRIEND_REQUEST' && !n.read_at && (
                    <button onClick={async () => {
                      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
                      window.location.href = '/friends';
                    }} className="flex-1 sm:flex-none border border-primary-container bg-primary-container/10 hover:bg-primary-container/20 text-primary-container px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                      View Request
                    </button>
                  )}
                  {!['PLAYER_INVITED', 'REFEREE_ASSIGNED', 'EVENT_REFEREE_ASSIGNED', 'FRIEND_REQUEST'].includes(n.type) && !n.read_at && (
                    <button onClick={async () => {
                      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
                      load();
                    }} className="flex-1 sm:flex-none border border-outline-variant bg-surface hover:border-on-surface hover:text-on-surface text-on-surface-variant px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors">
                      Dismiss
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
