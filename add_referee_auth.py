import re

s = open('apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/referee/page.tsx').read()

const_vars = """  const [matchState, setMatchState] = useState<MatchState>('SCHEDULED' as MatchState);
  const [elapsed, setElapsed] = useState(0);"""

new_vars = """  const [matchState, setMatchState] = useState<MatchState>('SCHEDULED' as MatchState);
  const [elapsed, setElapsed] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);"""

s = s.replace(const_vars, new_vars)

effect = """  // Sync state via Supabase Realtime
  useEffect(() => {"""

new_effect = """  // Sync state via Supabase Realtime
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAuthorized(false);
        return;
      }
      
      const { data: refData } = await supabase.from('match_referees')
        .select('id')
        .eq('match_id', matchId)
        .eq('user_id', session.user.id)
        .maybeSingle();
        
      if (refData) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }
    };
    checkAuth();"""

s = s.replace(effect, new_effect)

render = """  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 p-4">"""

new_render = """  if (isAuthorized === null) return <div className="p-12 text-center">Verifying Referee Assignment...</div>;
  if (isAuthorized === false) return (
    <div className="p-12 text-center text-red-600">
      <h1 className="text-2xl font-bold">Access Denied</h1>
      <p>You have not been assigned as a referee for this match.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 p-4">"""

s = s.replace(render, new_render)

open('apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/referee/page.tsx', 'w').write(s)
