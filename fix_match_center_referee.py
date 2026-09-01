import re

file_path = 'apps/web/src/app/(public)/events/[slug]/matches/[matchId]/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

state_old = """  const [isAdmin, setIsAdmin] = useState(false);"""
state_new = """  const [isAdmin, setIsAdmin] = useState(false);
  const [isReferee, setIsReferee] = useState(false);"""
content = content.replace(state_old, state_new)

role_old = """      if (session && match) {
        const { data: roleData } = await supabase.from('event_roles')
          .select('role')
          .eq('event_id', match.event_id)
          .eq('user_id', session.user.id)
          .in('role', ['EVENT_OWNER', 'EVENT_ADMIN'])
          .maybeSingle();
        if (roleData) setIsAdmin(true);
      }"""
role_new = """      if (session && match) {
        const { data: roleData } = await supabase.from('event_roles')
          .select('role')
          .eq('event_id', match.event_id)
          .eq('user_id', session.user.id)
          .in('role', ['EVENT_OWNER', 'EVENT_ADMIN', 'REFEREE'])
          .maybeSingle();
        if (roleData) {
          if (roleData.role === 'REFEREE') {
            setIsReferee(true);
          } else {
            setIsAdmin(true);
          }
        }
      }"""
content = content.replace(role_old, role_new)

ui_old = """      {/* Admin Quick Actions */}
      {isAdmin && (
      <div className="mb-6 flex gap-4 justify-center">
        <Link href={`/admin/events/${matchData.event_id || slug}/matches/${matchId}/referee`} className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded font-bold flex items-center gap-2 text-sm shadow-sm">
          <ShieldAlert className="w-4 h-4" /> Open Referee Dashboard
        </Link>
        <Link href={`/admin/events/${matchData.event_id || slug}/matches/${matchId}/recorder`} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2 text-sm shadow-sm">
          Open Event Recorder
        </Link>
      </div>
      )}"""
ui_new = """      {/* Admin Quick Actions */}
      {(isAdmin || isReferee) && (
      <div className="mb-6 flex gap-4 justify-center">
        <Link href={`/admin/events/${matchData.event_id || slug}/matches/${matchId}/referee`} className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded font-bold flex items-center gap-2 text-sm shadow-sm">
          <ShieldAlert className="w-4 h-4" /> Open Referee Dashboard
        </Link>
        {isAdmin && (
          <Link href={`/admin/events/${matchData.event_id || slug}/matches/${matchId}/recorder`} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2 text-sm shadow-sm">
            Open Event Recorder
          </Link>
        )}
      </div>
      )}"""
content = content.replace(ui_old, ui_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
