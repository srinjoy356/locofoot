import re

s = open('apps/web/src/app/(public)/events/[slug]/matches/[matchId]/page.tsx').read()

fetch_code = """      const [matchRes, timelineRes] = await Promise.all([
        supabase.from('matches').select('*, event:events(*), home:home_registration_id(*), away:away_registration_id(*)').eq('id', matchId).single(),
        supabase.from('match_timeline_events').select('*').eq('match_id', matchId).order('elapsed_seconds', { ascending: true })
      ]);"""

fetch_new = """      const [matchRes, timelineRes, refRes] = await Promise.all([
        supabase.from('matches').select('*, event:events(*), home:home_registration_id(*), away:away_registration_id(*)').eq('id', matchId).single(),
        supabase.from('match_timeline_events').select('*').eq('match_id', matchId).order('elapsed_seconds', { ascending: true }),
        supabase.from('match_referees').select('*, user:users(*)').eq('match_id', matchId).eq('status', 'ACCEPTED')
      ]);"""

s = s.replace(fetch_code, fetch_new)

state_code = """  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);"""

state_new = """  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [referees, setReferees] = useState<any[]>([]);"""

s = s.replace(state_code, state_new)

set_state_code = """      setMatchData(matchRes.data);
      setTimelineEvents(timelineRes.data || []);"""

set_state_new = """      setMatchData(matchRes.data);
      setTimelineEvents(timelineRes.data || []);
      setReferees(refRes.data || []);"""

s = s.replace(set_state_code, set_state_new)

ui_code = """                <h3 className="text-xl font-bold font-mono">
                  {homeGoals} - {awayGoals}
                </h3>
              </div>"""

ui_new = """                <h3 className="text-xl font-bold font-mono">
                  {homeGoals} - {awayGoals}
                </h3>
              </div>
              
              {referees.length > 0 && (
                <div className="absolute top-4 right-4 text-xs text-slate-500 bg-white/50 px-2 py-1 rounded-md border border-slate-200">
                  <span className="font-semibold">Referee:</span> {referees.map(r => r.user?.display_name || r.user?.username).join(', ')}
                </div>
              )}"""

s = s.replace(ui_code, ui_new)
open('apps/web/src/app/(public)/events/[slug]/matches/[matchId]/page.tsx', 'w').write(s)
