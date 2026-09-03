'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LineupPage({ params }: { params: Promise<{ slug: string, matchId: string }> }) {
  const { slug, matchId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [matchData, setMatchData] = useState<any>(null);
  const [eventData, setEventData] = useState<any>(null);
  const [teamRegistrationId, setTeamRegistrationId] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>({});
  
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  
  const [lineupStatus, setLineupStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: match } = await supabase
        .from('matches')
        .select(`
          id,
          event_id,
          home_registration_id,
          away_registration_id,
          home:event_team_registrations!home_registration_id(team_name),
          away:event_team_registrations!away_registration_id(team_name)
        `)
        .eq('id', matchId)
        .single();
        
      if (!match) return;
      setMatchData(match);

      const { data: event } = await supabase
        .from('events')
        .select('id, organizer_id')
        .eq('id', match.event_id)
        .single();
        
      const { data: eventSettings } = await supabase
        .from('event_settings')
        .select('players_on_field')
        .eq('event_id', match.event_id)
        .single();
        
      setEventData({ ...event, players_on_field: eventSettings?.players_on_field || 11 });

      const isOrganizer = event?.organizer_id === session.user.id;
      
      const { data: userTeams } = await supabase
        .from('event_team_players')
        .select('event_registration_id, is_captain_for_event')
        .eq('user_id', session.user.id)
        .in('event_registration_id', [match.home_registration_id, match.away_registration_id]);

      let userTeamId = null;
      if (userTeams && userTeams.length > 0) {
        const captainTeam = userTeams.find(t => t.is_captain_for_event);
        userTeamId = captainTeam ? captainTeam.event_registration_id : userTeams[0].event_registration_id;
      } else if (isOrganizer) {
        userTeamId = match.home_registration_id;
      }
      
      if (!userTeamId) {
        setDebug({
          sessionUserId: session.user.id,
          eventOrganizerId: event?.organizer_id,
          isOrganizer,
          userTeams,
          eventData: event
        });
        setIsLoading(false);
        return;
      }
      
      setTeamRegistrationId(userTeamId);

      const { data: teamPlayersData } = await supabase
        .from('event_team_players')
        .select(`
          id,
          user_id,
          jersey_number,
          position,
          users ( display_name )
        `)
        .eq('event_registration_id', userTeamId)
        .eq('status', 'APPROVED');
        
      setPlayers(teamPlayersData || []);

      const { data: lineups } = await supabase
        .from('match_lineups')
        .select('id, status')
        .eq('match_id', matchId)
        .eq('team_registration_id', userTeamId)
        .maybeSingle();
        
      if (lineups) {
        setLineupStatus(lineups.status);
        const { data: lineupPlayers } = await supabase
          .from('match_lineup_players')
          .select('event_team_player_id')
          .eq('lineup_id', lineups.id)
          .eq('lineup_role', 'STARTER');
          
        if (lineupPlayers) {
          const ids = new Set(lineupPlayers.map(lp => lp.event_team_player_id));
          setSelectedPlayerIds(ids);
        }
      }

      setIsLoading(false);
    }
    
    loadData();
  }, [matchId, supabase, router]);

  const togglePlayer = (playerId: string) => {
    if (lineupStatus === 'CONFIRMED') return;
    
    const newSelected = new Set(selectedPlayerIds);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      if (eventData && newSelected.size < eventData.players_on_field) {
        newSelected.add(playerId);
      } else {
        alert(`You can only select up to ${eventData?.players_on_field} starters.`);
      }
    }
    setSelectedPlayerIds(newSelected);
  };

  const submitLineup = async () => {
    if (!eventData || selectedPlayerIds.size !== eventData.players_on_field) return;
    
    setIsSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    const payload = {
      team_registration_id: teamRegistrationId,
      players: Array.from(selectedPlayerIds).map(id => ({
        event_team_player_id: id,
        lineup_role: 'STARTER'
      }))
    };
    
    try {
      const res = await fetch(`/api/v1/events/${eventData.id}/matches/${matchId}/lineups/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setLineupStatus('SUBMITTED');
        alert('Lineup submitted successfully!');
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.detail || 'Failed to submit lineup'}`);
      }
    } catch (e) {
      alert('Network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-12 text-center">Loading lineup builder...</div>;
  if (!teamRegistrationId) return (
    <div className="p-12 text-center">
      <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
      <p>You are not authorized to manage lineups for this match.</p>
      <pre className="text-left mt-8 p-4 bg-slate-900 text-slate-300 text-xs rounded overflow-auto">
        {JSON.stringify(debug, null, 2)}
      </pre>
    </div>
  );

  const requiredCount = eventData?.players_on_field || 0;
  const currentCount = selectedPlayerIds.size;
  const isValid = currentCount === requiredCount;
  
  const isHome = matchData.home_registration_id === teamRegistrationId;
  const teamName = isHome ? matchData.home?.team_name : matchData.away?.team_name;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <button onClick={() => router.back()} className="text-indigo-600 dark:text-indigo-400 font-bold mb-4 flex items-center gap-1 hover:underline">
          &larr; Back to Match Center
        </button>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100">{teamName} Lineup</h1>
          {lineupStatus && (
            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${lineupStatus === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
              Status: {lineupStatus}
            </span>
          )}
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 mb-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Select Starters</h2>
            <p className="text-slate-500 text-sm mt-1">
              Select exactly {requiredCount} players for the starting format.
            </p>
          </div>
          <div className="text-right">
            <span className={`text-3xl font-black tracking-tighter ${isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {currentCount} <span className="text-slate-400 text-xl">/ {requiredCount}</span>
            </span>
          </div>
        </div>

        <div className="space-y-3 mt-8">
          {players.map(p => {
            const isSelected = selectedPlayerIds.has(p.id);
            const disabled = lineupStatus === 'CONFIRMED';
            return (
              <button
                key={p.id}
                onClick={() => togglePlayer(p.id)}
                disabled={disabled}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${isSelected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-500/50 shadow-sm' : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950'} ${disabled ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-zinc-700'}`}>
                    {isSelected && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div>
                    <div className={`font-bold ${isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>{p.users?.display_name || 'Unknown Player'}</div>
                    {(p.jersey_number || p.position) && (
                      <div className="text-xs text-slate-500 mt-1 flex gap-2 font-medium">
                        {p.jersey_number && <span>#{p.jersey_number}</span>}
                        {p.position && <span>{p.position}</span>}
                      </div>
                    )}
                  </div>
                </div>
                {isSelected && <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2.5 py-1 rounded-md">Starter</span>}
              </button>
            );
          })}
          {players.length === 0 && (
            <div className="text-center p-8 text-slate-500 font-medium border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              No approved players found for this team.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={submitLineup}
          disabled={!isValid || isSubmitting || lineupStatus === 'CONFIRMED'}
          className={`px-10 py-4 rounded-xl font-bold transition-all shadow-md ${!isValid || lineupStatus === 'CONFIRMED' ? 'bg-slate-200 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-xl hover:-translate-y-0.5'}`}
        >
          {isSubmitting ? 'Submitting...' : (lineupStatus === 'CONFIRMED' ? 'Lineup Locked' : (lineupStatus ? 'Update Lineup' : 'Submit Lineup'))}
        </button>
      </div>
    </div>
  );
}
