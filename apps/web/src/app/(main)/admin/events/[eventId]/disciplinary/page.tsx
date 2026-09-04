'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, UserX, UserMinus } from 'lucide-react';

export default function DisciplinaryDashboardPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [disciplinaryStats, setDisciplinaryStats] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadStats() {
      // We pull from tournament_player_stats_view which already aggregates stats per player for the event
      const { data } = await supabase
        .from('tournament_player_stats_view')
        .select(`
          event_player_id,
          player_name,
          team_name,
          yellow_cards,
          red_cards
        `)
        .eq('event_id', eventId)
        .or('yellow_cards.gt.0,red_cards.gt.0');

      if (data) {
        // Map to expected format
        const offenders = data.map(stat => ({
          playerId: stat.event_player_id,
          playerName: stat.player_name,
          teamName: stat.team_name,
          yellow_cards: stat.yellow_cards || 0,
          red_cards: stat.red_cards || 0
        }));
        
        // Sort by red cards, then yellow cards
        offenders.sort((a, b) => b.red_cards - a.red_cards || b.yellow_cards - a.yellow_cards);
        
        setDisciplinaryStats(offenders);
      }
    }
    loadStats();
  }, [eventId, supabase]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold dark:text-zinc-100 flex items-center gap-2">
          <AlertTriangle className="text-amber-500" /> Disciplinary Dashboard
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400">Track player infractions, suspensions, and card accumulations.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300">
              <tr>
                <th className="p-4 font-semibold">Player</th>
                <th className="p-4 font-semibold">Team</th>
                <th className="p-4 font-semibold text-center">Yellow Cards</th>
                <th className="p-4 font-semibold text-center">Red Cards</th>
                <th className="p-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {disciplinaryStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-zinc-500 italic">
                    No disciplinary records found for this tournament yet.
                  </td>
                </tr>
              ) : (
                disciplinaryStats.map(stat => {
                  const isSuspended = stat.red_cards > 0 || stat.yellow_cards >= 3;
                  return (
                    <tr key={stat.playerId} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                      <td className="p-4 font-medium dark:text-zinc-200">{stat.playerName}</td>
                      <td className="p-4 text-gray-600 dark:text-zinc-400">{stat.teamName}</td>
                      <td className="p-4 text-center">
                        {stat.yellow_cards > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-8 bg-yellow-400 text-yellow-900 font-bold rounded-sm border border-yellow-500 shadow-sm">
                            {stat.yellow_cards}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-center">
                        {stat.red_cards > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-8 bg-red-600 text-white font-bold rounded-sm border border-red-700 shadow-sm">
                            {stat.red_cards}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-center">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold rounded">
                            <UserX className="w-3 h-3" /> Suspended
                          </span>
                        ) : stat.yellow_cards >= 2 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-bold rounded">
                            <UserMinus className="w-3 h-3" /> Warning (1 away)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold rounded">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
