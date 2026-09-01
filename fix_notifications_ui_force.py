import re

file_path = 'apps/web/src/app/(main)/notifications/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the whole return block
ret_new = """  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <div className="grid gap-4">
        {notifications.map(n => (
          <div key={n.id} className={`border p-4 rounded flex justify-between items-center ${n.read_at ? 'bg-gray-50 opacity-75' : 'bg-white font-semibold'}`}>
            <div>
              <p>
                {n.type === 'PLAYER_INVITED' && `🔔 Team invitation to join team`}
                {n.type === 'REFEREE_ASSIGNED' && `⚽ You have been assigned to officiate a match!`}
                {n.type === 'EVENT_REFEREE_ASSIGNED' && `⚽ You have been assigned as a Tournament Referee!`}
                {n.type === 'REFEREE_ACCEPTED' && `✅ Referee assignment accepted.`}
                {!['PLAYER_INVITED', 'REFEREE_ASSIGNED', 'REFEREE_ACCEPTED', 'EVENT_REFEREE_ASSIGNED'].includes(n.type) && `Notification: ${n.type}`}
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
            </div>
          </div>
        ))}
        {notifications.length === 0 && <p>No notifications.</p>}
      </div>
    </div>
  );
}
"""

content = re.sub(r'  return \(\s*<div className="space-y-6">.*', ret_new, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
