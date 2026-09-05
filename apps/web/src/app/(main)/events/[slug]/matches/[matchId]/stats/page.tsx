import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TurfHero } from '@/components/shared/TurfHero';

export default async function MatchStatsPage({ params }: { params: Promise<{ slug: string, matchId: string }> }) {
  const supabase = await createClient();
  const { slug, matchId } = await params;
  
  // 1. Fetch match basic info
  const { data: matchData, error: matchError } = await supabase
    .from('matches')
    .select(`
      *,
      home:home_registration_id ( id, team_name ),
      away:away_registration_id ( id, team_name )
    `)
    .eq('id', matchId)
    .single();

  if (matchError || !matchData) {
    console.error(matchError);
    notFound();
  }

  // 2. Fetch match statistics overview from the API
  let matchStats = null;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const res = await fetch(`${apiUrl}/api/v1/statistics/match-statistics/${matchId}`, {
      next: { revalidate: 60 }
    });
    if (res.ok) {
      matchStats = await res.json();
    }
  } catch (error) {
    console.error("Error fetching match stats from API:", error);
  }

  // 3. Fetch player performance
  let playerPerformance: any[] = [];
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const res = await fetch(`${apiUrl}/api/v1/statistics/match-player-performance/${matchId}`, {
      next: { revalidate: 60 }
    });
    if (res.ok) {
      playerPerformance = await res.json();
    }
  } catch (error) {
    console.error("Error fetching player performance from API:", error);
  }

  // 4. Fetch timeline events
  const { data: timelineData, error: timelineError } = await supabase
    .from('match_timeline_events')
    .select('*')
    .eq('match_id', matchId)
    .order('elapsed_seconds', { ascending: true });

  const timelineEvents = timelineData || [];
  
  // Player name dictionary
  const playerNames: Record<string, string> = {};
  
  // Fetch all players for fallback
  const { data: allPlayers } = await supabase.rpc('get_event_player_names', { p_event_id: matchData.event_id });
    
  if (allPlayers) {
    allPlayers.forEach((p: any) => {
      playerNames[p.player_id] = p.display_name;
    });
  }
  
  playerPerformance.forEach((p) => {
    playerNames[p.player_id] = p.player_name;
  });

  // Process Goals for Score Summary
  const homeGoals = timelineEvents.filter((e: any) => e.event_type === 'GOAL' && e.actor_registration_id === matchData.home_registration_id);
  const awayGoals = timelineEvents.filter((e: any) => e.event_type === 'GOAL' && e.actor_registration_id === matchData.away_registration_id);

  // Group goals by minute (for UI)
  const homeScorers = homeGoals.map((g: any) => ({
    name: playerNames[g.actor_player_id as string] || 'Unknown',
    minute: g.display_minute,
    isPenalty: g.metadata?.situation === 'PENALTY',
    isOwnGoal: false // TODO
  }));
  const awayScorers = awayGoals.map((g: any) => ({
    name: playerNames[g.actor_player_id as string] || 'Unknown',
    minute: g.display_minute,
    isPenalty: g.metadata?.situation === 'PENALTY',
    isOwnGoal: false
  }));

  // Identify key timeline moments (Goals, Cards, Subs, Big chances)
  // Let's get referee events too (Cards)
  const { data: refData } = await supabase
    .from('referee_events')
    .select('*')
    .eq('match_id', matchId)
    .in('event_type', ['YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION'])
    .order('elapsed_seconds', { ascending: true });
    
  const refEvents = refData || [];
  
  // Combine into single timeline and deduplicate referee events (in case of double clicks in UI)
  const uniqueRefEvents = refEvents.filter((event: any, index: number, self: any[]) => 
    index === self.findIndex((e) => (
      e.event_player_id === event.event_player_id &&
      e.event_type === event.event_type &&
      e.elapsed_seconds === event.elapsed_seconds
    ))
  );

  const combinedTimeline = [
    ...timelineEvents.filter((e: any) => 
      e.event_type === 'GOAL' || 
      (e.event_type === 'SHOT' && e.metadata?.result === 'GOAL') || 
      (e.event_type === 'SAVE' && e.metadata?.type === 'PENALTY')
    ),
    ...uniqueRefEvents
  ].sort((a: any, b: any) => a.elapsed_seconds - b.elapsed_seconds);

  return (
    <div className="w-full flex flex-col bg-background text-on-surface min-h-screen">
      <TurfHero
        eyebrow="Match Centre"
        title={<>Match <span className="text-primary-container">Stats</span></>}
        image="/turf/aerial-goal.jpg"
        size="sm"
      />

      <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-8">
        {/* HEADER SECTION */}
        <div className="bg-surface-container border border-outline-variant p-6 text-center">
        <div className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-6">
          {matchData.match_state === 'COMPLETED' || matchData.match_state === 'FULL_TIME' ? 'FULL TIME' : matchData.match_state.replace('_', ' ')}
        </div>
        
        <div className="flex justify-between items-center mb-6 max-w-2xl mx-auto">
          {/* HOME TEAM */}
          <div className="flex-1 text-right">
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase tracking-tighter text-on-surface">{matchData.home?.team_name || 'Home Team'}</h2>
            <div className="text-sm text-on-surface-variant mt-2 flex flex-col items-end gap-1">
              {homeScorers.map((g: any, i: number) => (
                <div key={i} className="flex gap-2 items-center">
                  <span>{g.name} {g.minute}' {g.isPenalty ? '(P)' : ''}</span>
                  ⚽
                </div>
              ))}
            </div>
          </div>
          
          {/* SCORE */}
          <div className="px-12">
             <div className="text-5xl font-black font-mono bg-surface-container-high border border-outline-variant px-6 py-4 tracking-tighter tabular-nums text-on-surface">
               {matchStats ? `${matchStats.home_goals} - ${matchStats.away_goals}` : '0 - 0'}
             </div>
          </div>
          
          {/* AWAY TEAM */}
          <div className="flex-1 text-left">
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase tracking-tighter text-on-surface">{matchData.away?.team_name || 'Away Team'}</h2>
            <div className="text-sm text-on-surface-variant mt-2 flex flex-col items-start gap-1">
              {awayScorers.map((g: any, i: number) => (
                <div key={i} className="flex gap-2 items-center">
                  ⚽
                  <span>{g.name} {g.minute}' {g.isPenalty ? '(P)' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="border-b border-outline-variant pb-2 flex gap-6 px-2">
        <div className="font-label-caps text-label-caps uppercase tracking-widest border-b-2 border-primary-container pb-2 text-on-surface">Stats Dashboard</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">
          {/* TWO-COLUMN TEAM COMPARISON */}
          {matchStats && (
            <div className="bg-surface-container border border-outline-variant overflow-hidden">
              <div className="bg-surface-container-high p-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Team Statistics</div>
              <div className="p-6 space-y-5">
                <StatRow label="Goals" home={matchStats.home_goals} away={matchStats.away_goals} />
                <StatRow label="Shots" home={matchStats.home_shots} away={matchStats.away_shots} />
                <StatRow label="Shots on Target" home={matchStats.home_shots_on_target} away={matchStats.away_shots_on_target} />
                <StatRow label="Passes Attempted" home={matchStats.home_passes} away={matchStats.away_passes} />
                <StatRow label="Pass Accuracy (%)" home={matchStats.home_pass_accuracy_percent} away={matchStats.away_pass_accuracy_percent} />
                <StatRow label="Successful Dribbles" home={matchStats.home_successful_dribbles} away={matchStats.away_successful_dribbles} />
                <StatRow label="Tackles Won" home={matchStats.home_tackles_won} away={matchStats.away_tackles_won} />
                <StatRow label="Recoveries" home={matchStats.home_recoveries} away={matchStats.away_recoveries} />
                <StatRow label="Interceptions" home={matchStats.home_interceptions} away={matchStats.away_interceptions} />
                <StatRow label="Clearances" home={matchStats.home_clearances} away={matchStats.away_clearances} />
                <StatRow label="Aerial Duels Won" home={matchStats.home_aerial_duels_won} away={matchStats.away_aerial_duels_won} />
                <StatRow label="Fouls" home={matchStats.home_fouls} away={matchStats.away_fouls} />
                <StatRow label="Yellow Cards" home={matchStats.home_yellow_cards} away={matchStats.away_yellow_cards} />
                <StatRow label="Red Cards" home={matchStats.home_red_cards} away={matchStats.away_red_cards} />
                <StatRow label="Great First Touches" home={matchStats.home_great_first_touches} away={matchStats.away_great_first_touches} />
              </div>
            </div>
          )}

          {/* PLAYER PERFORMANCE TABLE */}
          {playerPerformance && playerPerformance.length > 0 && (
            <div className="space-y-6">
              {/* HOME TEAM */}
              <div className="bg-surface-container border border-outline-variant overflow-hidden">
                 <div className="bg-surface-container-high p-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant flex justify-between">
                    <span>{matchData.home?.team_name} Players</span>
                 </div>
                 <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant">
                       <tr>
                         <th className="p-3 font-semibold">Player</th>
                         <th className="p-3 font-semibold text-center">Min</th>
                         <th className="p-3 font-semibold text-center">G</th>
                         <th className="p-3 font-semibold text-center">A</th>
                         <th className="p-3 font-semibold text-center">S (SoT)</th>
                         <th className="p-3 font-semibold text-center">Pass%</th>
                         <th className="p-3 font-semibold text-center">Rating</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-outline-variant">
                       {playerPerformance.filter((p: any) => p.registration_id === matchData.home_registration_id).map((p: any) => (
                         <tr key={p.player_id} className="hover:bg-surface-variant">
                           <td className="p-3 font-medium flex items-center gap-2">
                             {p.is_mvp && <span className="text-yellow-400 text-xs font-bold" title="POTM">⭐</span>}
                             {p.player_name}
                           </td>
                           <td className="p-3 text-on-surface-variant text-center">{p.minutes_played}'</td>
                           <td className="p-3 font-semibold text-center">{p.goals > 0 ? p.goals : <span className="text-outline-variant">-</span>}</td>
                           <td className="p-3 font-semibold text-center">{p.assists > 0 ? p.assists : <span className="text-outline-variant">-</span>}</td>
                           <td className="p-3 text-center">{p.shots} <span className="text-on-surface-variant">({p.shots_on_target})</span></td>
                           <td className="p-3 text-center">{p.pass_accuracy}%</td>
                           <td className="p-3 text-center">
                             <span className={`px-2 py-1 text-xs font-bold ${p.rating >= 8 ? 'bg-primary-container/20 text-primary-container' : p.rating >= 6 ? 'bg-surface-variant text-on-surface' : 'bg-error/20 text-error'}`}>
                               {p.rating ? parseFloat(p.rating).toFixed(1) : '-'}
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
              </div>

              {/* AWAY TEAM */}
              <div className="bg-surface-container border border-outline-variant overflow-hidden">
                 <div className="bg-surface-container-high p-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant flex justify-between">
                    <span>{matchData.away?.team_name} Players</span>
                 </div>
                 <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant">
                       <tr>
                         <th className="p-3 font-semibold">Player</th>
                         <th className="p-3 font-semibold text-center">Min</th>
                         <th className="p-3 font-semibold text-center">G</th>
                         <th className="p-3 font-semibold text-center">A</th>
                         <th className="p-3 font-semibold text-center">S (SoT)</th>
                         <th className="p-3 font-semibold text-center">Pass%</th>
                         <th className="p-3 font-semibold text-center">Rating</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-outline-variant">
                       {playerPerformance.filter((p: any) => p.registration_id === matchData.away_registration_id).map((p: any) => (
                         <tr key={p.player_id} className="hover:bg-surface-variant">
                           <td className="p-3 font-medium flex items-center gap-2">
                             {p.is_mvp && <span className="text-yellow-400 text-xs font-bold" title="POTM">⭐</span>}
                             {p.player_name}
                           </td>
                           <td className="p-3 text-on-surface-variant text-center">{p.minutes_played}'</td>
                           <td className="p-3 font-semibold text-center">{p.goals > 0 ? p.goals : <span className="text-outline-variant">-</span>}</td>
                           <td className="p-3 font-semibold text-center">{p.assists > 0 ? p.assists : <span className="text-outline-variant">-</span>}</td>
                           <td className="p-3 text-center">{p.shots} <span className="text-on-surface-variant">({p.shots_on_target})</span></td>
                           <td className="p-3 text-center">{p.pass_accuracy}%</td>
                           <td className="p-3 text-center">
                             <span className={`px-2 py-1 text-xs font-bold ${p.rating >= 8 ? 'bg-primary-container/20 text-primary-container' : p.rating >= 6 ? 'bg-surface-variant text-on-surface' : 'bg-error/20 text-error'}`}>
                               {p.rating ? parseFloat(p.rating).toFixed(1) : '-'}
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-6">
           
           {/* MATCH TIMELINE */}
           <div className="bg-surface-container border border-outline-variant overflow-hidden">
              <div className="bg-surface-container-high p-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Key Moments</div>
              <div className="p-4 space-y-4">
                {combinedTimeline.length === 0 ? (
                  <div className="text-sm text-on-surface-variant text-center p-4">No key events recorded.</div>
                ) : (
                  combinedTimeline.map((e, i) => {
                     const isHome = e.actor_registration_id === matchData.home_registration_id || e.event_registration_id === matchData.home_registration_id;
                     const name = playerNames[e.actor_player_id || e.event_player_id] || 'Unknown Player';
                     let icon = '⏱️';
                     if (e.event_type === 'SHOT' || e.event_type === 'GOAL') icon = '⚽';
                     if (e.event_type === 'YELLOW_CARD') icon = '🟨';
                     if (e.event_type === 'RED_CARD') icon = '🟥';
                     
                     return (
                       <div key={i} className={`flex gap-3 text-sm items-center ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
                         <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center font-bold text-xs shrink-0 text-on-surface">
                           {e.display_minute}'
                         </div>
                         <div className="bg-surface-variant px-3 py-2 flex items-center gap-2">
                            <span>{icon}</span>
                            <span className="font-semibold text-on-surface">{name}</span>
                         </div>
                       </div>
                     );
                  })
                )}
              </div>
           </div>

           {/* PLAYER MATCH CARDS */}
           <div className="bg-surface-container border border-outline-variant overflow-hidden">
              <div className="bg-surface-container-high p-4 font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">Match Awards</div>
              <div className="p-4 space-y-4">
                {playerPerformance.filter(p => p.is_mvp).map((p, i) => (
                  <div key={i} className="flex gap-4 items-center bg-gradient-to-r from-primary-container/10 to-transparent p-4 border border-primary-container/30">
                     <div className="text-4xl">⭐</div>
                     <div>
                       <div className="font-label-caps text-label-caps text-primary-container font-bold uppercase tracking-widest">Player of the Match</div>
                       <div className="font-headline-sm text-headline-sm text-on-surface">{p.player_name}</div>
                       <div className="text-sm text-on-surface-variant">{p.rating} Rating • {p.goals}G {p.assists}A</div>
                     </div>
                  </div>
                ))}
              </div>
           </div>
        </div>

      </div>
      </div>
    </div>
  );
}

function StatRow({ label, home, away }: { label: string, home: number | string, away: number | string }) {
  const h = Number(home) || 0;
  const a = Number(away) || 0;
  const total = h + a;
  const hPercent = total > 0 ? (h / total) * 100 : 50;
  const aPercent = total > 0 ? (a / total) * 100 : 50;

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex justify-between items-center text-on-surface">
        <span className="font-black text-lg w-12 text-left">{home}</span>
        <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">{label}</span>
        <span className="font-black text-lg w-12 text-right">{away}</span>
      </div>
      {total > 0 && (
        <div className="flex h-1.5 overflow-hidden bg-surface-container-high gap-1">
          <div className="bg-primary-container h-full transition-all duration-500" style={{ width: `${hPercent}%` }}></div>
          <div className="bg-outline h-full transition-all duration-500" style={{ width: `${aPercent}%` }}></div>
        </div>
      )}
    </div>
  );
}
