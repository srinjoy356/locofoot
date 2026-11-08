'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiJson } from '@/lib/api';

type Row = { user_id: string; display_name: string; profit: number; bets_settled: number; bets_won: number; win_rate: number | null; biggest_win: number; balance: number };

/** Prediction leaderboard (profit on settled predictions). Refreshes when any prediction settles. */
export function LeaderboardTable({ eventId, limit = 10, meId }: { eventId?: string | null; limit?: number; meId?: string | null }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (eventId) q.set('event_id', eventId);
    const res = await apiJson<Row[]>(`/api/v1/predictions/leaderboard?${q}`);
    if (res.ok) setRows(res.data);
  }, [eventId, limit]);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase.channel(`leaderboard:${eventId ?? 'all'}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bet_markets' }, () => load())
      .subscribe();
    const poll = setInterval(load, 20000);
    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [eventId, load]);

  if (!rows) return <p className="p-4 text-sm text-on-surface-variant">Loading leaderboard...</p>;
  if (rows.length === 0) return <p className="p-6 text-center text-sm text-on-surface-variant">No settled predictions yet. Be the first on the board.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-3 py-2 text-right">Profit</th>
            <th className="px-3 py-2 text-right">Won</th>
            <th className="px-3 py-2 text-right">Hit rate</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">Best win</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.user_id} className={`border-t border-outline-variant ${r.user_id === meId ? 'bg-primary-container/10' : ''}`}>
              <td className="px-3 py-2 font-mono text-on-surface-variant">{i + 1}</td>
              <td className="px-3 py-2 text-on-surface">{r.display_name}{r.user_id === meId && <span className="ml-2 font-label-caps text-[9px] tracking-widest text-primary-container">YOU</span>}</td>
              <td className={`px-3 py-2 text-right font-mono font-bold ${r.profit > 0 ? 'text-primary-container' : r.profit < 0 ? 'text-error' : 'text-on-surface'}`}>{r.profit > 0 ? `+${r.profit}` : r.profit}</td>
              <td className="px-3 py-2 text-right font-mono text-on-surface-variant">{r.bets_won}/{r.bets_settled}</td>
              <td className="px-3 py-2 text-right font-mono text-on-surface-variant">{r.win_rate ?? 0}%</td>
              <td className="hidden px-3 py-2 text-right font-mono text-on-surface-variant sm:table-cell">{r.biggest_win}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
