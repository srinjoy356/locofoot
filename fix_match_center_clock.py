import re

file_path = 'apps/web/src/app/(public)/events/[slug]/matches/[matchId]/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add eventSettings fetch
fetch_old = """      const { data: { session } } = await supabase.auth.getSession();"""
fetch_new = """      const { data: settings } = await supabase.from('event_settings').select('first_half_minutes, second_half_minutes').eq('event_id', match.event_id).maybeSingle();
      if (settings) setEventSettings(settings);

      const { data: { session } } = await supabase.auth.getSession();"""
content = content.replace(fetch_old, fetch_new)

state_old = """  const [isReferee, setIsReferee] = useState(false);"""
state_new = """  const [isReferee, setIsReferee] = useState(false);
  const [eventSettings, setEventSettings] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);"""
content = content.replace(state_old, state_new)

# 2. Add interval for clock
interval_old = """  }, [matchId, supabase]);

  if (isLoading) return <div className="text-center p-12">Loading Match Center...</div>;"""
interval_new = """  }, [matchId, supabase]);

  useEffect(() => {
    let timer: any;
    if (matchData && (matchData.match_state === 'LIVE' || matchData.match_state === 'FIRST_HALF' || matchData.match_state === 'SECOND_HALF' || matchData.match_state === 'EXTRA_TIME_1' || matchData.match_state === 'EXTRA_TIME_2')) {
      timer = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [matchData]);

  if (isLoading) return <div className="text-center p-12">Loading Match Center...</div>;"""
content = content.replace(interval_old, interval_new)

# 3. Format clock helper
format_old = """  const allEvents = [...timelineEvents, ...refereeEvents].sort((a, b) => b.elapsed_seconds - a.elapsed_seconds);

  return ("""
format_new = """  const allEvents = [...timelineEvents, ...refereeEvents].sort((a, b) => b.elapsed_seconds - a.elapsed_seconds);

  const formatClock = () => {
    let baseTimeMinutes = 0;
    if (eventSettings && matchData) {
      if (matchData.match_state === 'FIRST_HALF' || matchData.match_state === 'LIVE') baseTimeMinutes = eventSettings.first_half_minutes;
      if (matchData.match_state === 'SECOND_HALF') baseTimeMinutes = eventSettings.first_half_minutes + eventSettings.second_half_minutes;
    }
    
    // Default fallback
    if (!baseTimeMinutes) baseTimeMinutes = 45; 

    const totalMinutes = Math.floor(elapsed / 60);
    const totalSeconds = elapsed % 60;

    if (totalMinutes >= baseTimeMinutes) {
      const addedMinutes = totalMinutes - baseTimeMinutes;
      return `${baseTimeMinutes.toString().padStart(2, '0')}:00 + ${addedMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;
    }

    return `${totalMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;
  };

  return ("""
content = content.replace(format_old, format_new)

# 4. Show clock instead of text
ui_old = """        <div className="mt-8 text-slate-400 text-sm font-medium flex justify-center items-center gap-2">
           <Clock className="w-4 h-4" /> Final score is evaluated by Match Engine
        </div>"""
ui_new = """        <div className="mt-8 flex justify-center items-center gap-4">
           <div className="bg-slate-800/80 rounded-xl px-6 py-2 border border-slate-700/50 shadow-inner">
             <div className="text-2xl font-mono font-bold text-slate-200">
               {formatClock()}
             </div>
           </div>
        </div>"""
content = content.replace(ui_old, ui_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
