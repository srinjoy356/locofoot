import re

file_path = 'apps/web/src/app/(admin)/admin/events/[eventId]/matches/[matchId]/referee/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add eventSettings state and fetch it
state_old = """  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);"""
state_new = """  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [eventSettings, setEventSettings] = useState<any>(null);"""
content = content.replace(state_old, state_new)

auth_fetch_old = """      const { data: refData } = await supabase.from('match_referees')
        .select('id')
        .eq('match_id', matchId)
        .eq('user_id', session.user.id)
        .maybeSingle();
        
      if (refData) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }"""
auth_fetch_new = """      const { data: refData } = await supabase.from('match_referees')
        .select('id')
        .eq('match_id', matchId)
        .eq('user_id', session.user.id)
        .maybeSingle();
        
      if (refData) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }

      // Fetch event settings for clock formatting
      const { data: settings } = await supabase.from('event_settings').select('first_half_minutes, second_half_minutes').eq('event_id', eventId).maybeSingle();
      if (settings) {
        setEventSettings(settings);
      }
      
      // Fetch current state
      const { data: mData } = await supabase.from('matches').select('match_state').eq('id', matchId).maybeSingle();
      if (mData) {
        setMatchState(mData.match_state as MatchState);
      }"""
content = content.replace(auth_fetch_old, auth_fetch_new)

# 2. Add the ticking interval
interval_old = """  }, [matchId]);

  const changeState = async (newState: MatchState) => {"""
interval_new = """  }, [matchId]);

  useEffect(() => {
    let timer: any;
    if (matchState === 'LIVE' || matchState === 'FIRST_HALF' || matchState === 'SECOND_HALF' || matchState === 'EXTRA_TIME_1' || matchState === 'EXTRA_TIME_2') {
      timer = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [matchState]);

  const changeState = async (newState: MatchState) => {"""
content = content.replace(interval_old, interval_new)

# 3. Format time helper
format_old = """  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col">"""
format_new = """  const formatClock = () => {
    let baseTimeMinutes = 0;
    if (eventSettings) {
      if (matchState === 'FIRST_HALF' || matchState === 'LIVE') baseTimeMinutes = eventSettings.first_half_minutes;
      if (matchState === 'SECOND_HALF') baseTimeMinutes = eventSettings.first_half_minutes + eventSettings.second_half_minutes;
    }
    
    // Default fallback if not FIRST_HALF / SECOND_HALF
    if (!baseTimeMinutes) baseTimeMinutes = 45; // Standard 45

    const totalMinutes = Math.floor(elapsed / 60);
    const totalSeconds = elapsed % 60;

    if (totalMinutes >= baseTimeMinutes) {
      const addedMinutes = totalMinutes - baseTimeMinutes;
      return `${baseTimeMinutes.toString().padStart(2, '0')}:00 + ${addedMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;
    }

    return `${totalMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col">"""
content = content.replace(format_old, format_new)

# 4. Use it in the UI
h1_old = """        <h1 className="text-4xl font-mono font-bold">{Math.floor(elapsed / 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')}</h1>"""
h1_new = """        <h1 className="text-4xl font-mono font-bold">{formatClock()}</h1>"""
content = content.replace(h1_old, h1_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
