import re

file_path = 'apps/web/src/app/(main)/notifications/page.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Add acceptMatchReferee function
func_old = """  async function acceptInvite(eventId: string, regId: string, invId: string, notifId: string) {"""
func_new = """  async function acceptRefereeAssignment(matchId: string, notifId: string) {
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

  async function acceptInvite(eventId: string, regId: string, invId: string, notifId: string) {"""
content = content.replace(func_old, func_new)

# 2. Update the UI to render the button
ui_old = """            <div>
              <p>{n.type === 'PLAYER_INVITED' ? `🔔 Team invitation to join team` : `Notification: ${n.type}`}</p>
              <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</p>
            </div>
            {n.type === 'PLAYER_INVITED' && !n.read_at && (
              <button onClick={() => acceptInvite(n.payload.event_id, n.payload.registration_id, n.payload.invitation_id, n.id)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">
                Accept
              </button>
            )}"""
ui_new = """            <div>
              <p>
                {n.type === 'PLAYER_INVITED' && `🔔 Team invitation to join team`}
                {n.type === 'REFEREE_ASSIGNED' && `⚽ You have been assigned to officiate a match!`}
                {n.type === 'REFEREE_ACCEPTED' && `✅ Referee assignment accepted.`}
                {!['PLAYER_INVITED', 'REFEREE_ASSIGNED', 'REFEREE_ACCEPTED'].includes(n.type) && `Notification: ${n.type}`}
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
            </div>"""
content = content.replace(ui_old, ui_new)

with open(file_path, 'w') as f:
    f.write(content)
