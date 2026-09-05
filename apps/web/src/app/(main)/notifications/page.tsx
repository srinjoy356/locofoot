"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <div className="grid gap-4">
        {notifications.map(n => (
          <div key={n.id} className={`border p-4 rounded flex justify-between items-center ${n.read_at ? 'bg-slate-50 dark:bg-zinc-900/50 opacity-75' : 'bg-white dark:bg-zinc-900 font-semibold'}`}>
            <div>
              <p>
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
              <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              {n.type === 'PLAYER_INVITED' && !n.read_at && (
                <button onClick={() => acceptInvite(n.payload.event_id, n.payload.registration_id, n.payload.invitation_id, n.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-bold">
                  Accept Team Invite
                </button>
              )}
              {n.type === 'REFEREE_ASSIGNED' && !n.read_at && (
                <button onClick={() => acceptRefereeAssignment(n.payload.match_id, n.id)} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-sm font-bold shadow">
                  Accept Match Assignment
                </button>
              )}
              {n.type === 'EVENT_REFEREE_ASSIGNED' && !n.read_at && (
                <button onClick={async () => {
                  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
                  load();
                }} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-sm font-bold shadow">
                  Acknowledge
                </button>
              )}
              {n.type === 'FRIEND_REQUEST' && !n.read_at && (
                <button onClick={async () => {
                  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
                  window.location.href = '/friends';
                }} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-bold shadow">
                  View Request
                </button>
              )}
              {!['PLAYER_INVITED', 'REFEREE_ASSIGNED', 'EVENT_REFEREE_ASSIGNED', 'FRIEND_REQUEST'].includes(n.type) && !n.read_at && (
                <button onClick={async () => {
                  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
                  load();
                }} className="bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 px-3 py-1 rounded text-sm font-bold shadow">
                  Dismiss
                </button>
              )}
            </div>
          </div>
        ))}
        {notifications.length === 0 && <p>No notifications.</p>}
      </div>
    </div>
  );
}
