import re

s = open('apps/web/src/app/(public)/events/[slug]/matches/[matchId]/page.tsx').read()

const_isAdmin = """  const [matchData, setMatchData] = useState<any>(null);"""
const_isAdmin_new = """  const [matchData, setMatchData] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);"""
s = s.replace(const_isAdmin, const_isAdmin_new)

fetch_isAdmin = """      if (referee) setRefereeEvents(referee);
      setIsLoading(false);"""
fetch_isAdmin_new = """      if (referee) setRefereeEvents(referee);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session && match) {
        const { data: roleData } = await supabase.from('event_roles')
          .select('role')
          .eq('event_id', match.event_id)
          .eq('user_id', session.user.id)
          .in('role', ['EVENT_OWNER', 'EVENT_ADMIN'])
          .maybeSingle();
        if (roleData) setIsAdmin(true);
      }
      
      setIsLoading(false);"""
s = s.replace(fetch_isAdmin, fetch_isAdmin_new)

ui_isAdmin = """      {/* Admin Quick Actions */}
      <div className="mb-6 flex gap-4 justify-center">"""
ui_isAdmin_new = """      {/* Admin Quick Actions */}
      {isAdmin && (
      <div className="mb-6 flex gap-4 justify-center">"""
s = s.replace(ui_isAdmin, ui_isAdmin_new)

ui_isAdmin2 = """        </Link>
      </div>
      
      {/* Scoreboard */}"""
ui_isAdmin2_new = """        </Link>
      </div>
      )}
      
      {/* Scoreboard */}"""
s = s.replace(ui_isAdmin2, ui_isAdmin2_new)

open('apps/web/src/app/(public)/events/[slug]/matches/[matchId]/page.tsx', 'w').write(s)
