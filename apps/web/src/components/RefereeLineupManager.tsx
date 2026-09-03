'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function RefereeLineupManager({ eventId, matchId }: { eventId: string, matchId: string }) {
  const supabase = createClient();
  const [matchData, setMatchData] = useState<any>(null);
  const [homeLineup, setHomeLineup] = useState<any>(null);
  const [awayLineup, setAwayLineup] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: match } = await supabase
        .from('matches')
        .select(`
          home_registration_id,
          away_registration_id,
          home:event_team_registrations!home_registration_id(team_name),
          away:event_team_registrations!away_registration_id(team_name)
        `)
        .eq('id', matchId)
        .single();
        
      if (match) setMatchData(match);

      const { data: lineups } = await supabase
        .from('match_lineups')
        .select('*')
        .eq('match_id', matchId);

      if (lineups && match) {
        setHomeLineup(lineups.find(l => l.team_registration_id === match.home_registration_id));
        setAwayLineup(lineups.find(l => l.team_registration_id === match.away_registration_id));
      }

      setIsLoading(false);
    }
    
    loadData();

    // Listen to changes
    const channel = supabase.channel(`lineups:${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_lineups', filter: `match_id=eq.${matchId}` }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, supabase]);

  const confirmLineup = async (teamRegistrationId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`/api/v1/events/${eventId}/matches/${matchId}/lineups/confirm?team_registration_id=${teamRegistrationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.detail || 'Could not confirm lineup'}`);
      }
    } catch (e) {
      alert('Network error confirming lineup');
    }
  };

  if (isLoading) return <div className="text-center text-slate-500 py-4">Checking lineups...</div>;
  if (!matchData) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
      <h2 className="text-lg font-bold mb-3">Lineup Status</h2>
      <div className="grid grid-cols-2 gap-4">
        {/* Home Team */}
        <div className="border border-slate-100 dark:border-zinc-800 rounded-lg p-3 bg-slate-50 dark:bg-zinc-950">
          <div className="font-bold text-sm truncate" title={matchData.home?.team_name}>{matchData.home?.team_name || 'Home'}</div>
          <div className="mt-2 text-xs font-semibold mb-3">
            Status: <span className={homeLineup?.status === 'CONFIRMED' ? 'text-emerald-600' : 'text-amber-600'}>{homeLineup?.status || 'NOT SUBMITTED'}</span>
          </div>
          {homeLineup?.status === 'SUBMITTED' && (
            <button
              onClick={() => confirmLineup(matchData.home_registration_id)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded"
            >
              CONFIRM LINEUP
            </button>
          )}
          {homeLineup?.status === 'CONFIRMED' && (
            <div className="w-full text-center text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-xs font-bold py-2 rounded">
              CONFIRMED
            </div>
          )}
          {(!homeLineup || homeLineup.status === 'DRAFT') && (
            <div className="w-full text-center text-slate-400 text-xs font-bold py-2 border border-dashed rounded">
              WAITING
            </div>
          )}
        </div>

        {/* Away Team */}
        <div className="border border-slate-100 dark:border-zinc-800 rounded-lg p-3 bg-slate-50 dark:bg-zinc-950">
          <div className="font-bold text-sm truncate" title={matchData.away?.team_name}>{matchData.away?.team_name || 'Away'}</div>
          <div className="mt-2 text-xs font-semibold mb-3">
            Status: <span className={awayLineup?.status === 'CONFIRMED' ? 'text-emerald-600' : 'text-amber-600'}>{awayLineup?.status || 'NOT SUBMITTED'}</span>
          </div>
          {awayLineup?.status === 'SUBMITTED' && (
            <button
              onClick={() => confirmLineup(matchData.away_registration_id)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded"
            >
              CONFIRM LINEUP
            </button>
          )}
          {awayLineup?.status === 'CONFIRMED' && (
            <div className="w-full text-center text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-xs font-bold py-2 rounded">
              CONFIRMED
            </div>
          )}
          {(!awayLineup || awayLineup.status === 'DRAFT') && (
            <div className="w-full text-center text-slate-400 text-xs font-bold py-2 border border-dashed rounded">
              WAITING
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
