'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, UserX, UserMinus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
    <div className="w-full bg-background min-h-[calc(100vh-64px)] text-on-surface">
      {/* Top Bar */}
      <div className="border-b border-outline-variant bg-surface sticky top-0 z-10">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter h-14 flex items-center justify-between">
          <Link href={`/admin/events/${eventId}`} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft size={16} />
            <span className="font-label-caps text-label-caps uppercase tracking-widest">EVENT DASHBOARD</span>
          </Link>
        </div>
      </div>

      <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter py-8 space-y-12">
        <div className="relative overflow-hidden border border-outline-variant bg-[#151816]">
          <div className="absolute inset-0 z-0">
            <img alt="" aria-hidden="true" className="w-full h-full object-cover object-center  opacity-25 " src="/turf/turf-closeup.jpg" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40 z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
          </div>
          <div className="relative z-20 p-6 md:p-8">
            <span className="mb-3 flex items-center gap-2 font-label-caps text-label-caps text-primary-container uppercase tracking-widest">
              <AlertTriangle size={14} /> Event Operations
            </span>
            <h1 className="font-display-lg text-display-lg md:text-[56px] uppercase tracking-tighter leading-none text-on-surface">
              Disciplinary Dashboard
            </h1>
            <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mt-4 max-w-xl">
              Track player infractions, suspensions, and card accumulations.
            </p>
          </div>
        </div>

        <div className="border border-outline-variant bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container border-b border-outline-variant">
                <tr>
                  <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Player</th>
                  <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Team</th>
                  <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant text-center">Yellow Cards</th>
                  <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant text-center">Red Cards</th>
                  <th className="p-4 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {disciplinaryStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                      No disciplinary records found for this tournament yet.
                    </td>
                  </tr>
                ) : (
                  disciplinaryStats.map(stat => {
                    const isSuspended = stat.red_cards > 0 || stat.yellow_cards >= 3;
                    return (
                      <tr key={stat.playerId} className="hover:bg-surface-variant transition-colors">
                        <td className="p-4 font-body-md text-on-surface">{stat.playerName}</td>
                        <td className="p-4 font-body-sm text-on-surface-variant">{stat.teamName}</td>
                        <td className="p-4 text-center">
                          {stat.yellow_cards > 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-8 bg-yellow-400 text-background font-bold border border-outline-variant">
                              {stat.yellow_cards}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-4 text-center">
                          {stat.red_cards > 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-8 bg-error text-on-error font-bold border border-outline-variant">
                              {stat.red_cards}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-4 text-center">
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 border border-error bg-error/10 text-error font-label-caps text-[10px] uppercase tracking-widest">
                              <UserX className="w-3 h-3" /> Suspended
                            </span>
                          ) : stat.yellow_cards >= 2 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 border border-yellow-400 bg-yellow-400/10 text-yellow-400 font-label-caps text-[10px] uppercase tracking-widest">
                              <UserMinus className="w-3 h-3" /> Warning (1 away)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 border border-primary-container bg-primary-container/10 text-primary-container font-label-caps text-[10px] uppercase tracking-widest">
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
    </div>
  );
}
