'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Side = { team_id: string | null; name: string | null; placeholder: string };
type BracketMatch = {
  id: string;
  match_id: string;
  round_name: string;
  position: number;
  home: Side;
  away: Side;
  home_score: number | null;
  away_score: number | null;
  state: string | null;
  winner_id: string | null;
  shootout?: { home: number; away: number } | null;
};
type GroupRow = { team_id: string; team_name: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number };
type Group = { group_id: string; name: string; complete: boolean; rows: GroupRow[] };

const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'FINAL'];
const ROUND_TITLES: Record<string, string> = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', FINAL: 'Final', THIRD_PLACE: 'Third place' };

export function roundSort(a: string, b: string) {
  const ia = ROUND_ORDER.indexOf(a), ib = ROUND_ORDER.indexOf(b);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
}

function TeamLine({ side, score, won, lost }: { side: Side; score: number | null; won: boolean; lost: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 ${won ? 'bg-primary-container/10' : ''}`}>
      <span className={`truncate font-label-caps text-[11px] uppercase tracking-widest ${side.name ? (lost ? 'text-on-surface-variant' : 'text-on-surface') : 'italic text-on-surface-variant/60'}`}>
        {side.name || side.placeholder}
      </span>
      <span className={`font-mono text-sm tabular-nums ${won ? 'text-primary-container font-bold' : 'text-on-surface-variant'}`}>{score ?? '-'}</span>
    </div>
  );
}

function MatchCard({ m }: { m: BracketMatch }) {
  const done = m.state === 'COMPLETED';
  return (
    <div className="w-56 shrink-0 border border-outline-variant bg-[#151816]">
      <TeamLine side={m.home} score={m.home_score} won={done && !!m.winner_id && m.winner_id === m.home.team_id} lost={done && !!m.winner_id && m.winner_id !== m.home.team_id} />
      <div className="border-t border-outline-variant" />
      <TeamLine side={m.away} score={m.away_score} won={done && !!m.winner_id && m.winner_id === m.away.team_id} lost={done && !!m.winner_id && m.winner_id !== m.away.team_id} />
      {m.shootout && (
        <div className="border-t border-outline-variant px-3 py-1 text-right font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">
          Pens {m.shootout.home} - {m.shootout.away}
        </div>
      )}
    </div>
  );
}

export function BracketView({ matches }: { matches: BracketMatch[] }) {
  const rounds = Array.from(new Set(matches.map((m) => m.round_name))).filter((r) => r !== 'THIRD_PLACE').sort(roundSort);
  const third = matches.find((m) => m.round_name === 'THIRD_PLACE');
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-stretch gap-8">
        {rounds.map((r) => (
          <div key={r} className="flex flex-col">
            <h4 className="mb-3 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">{ROUND_TITLES[r] || r}</h4>
            {/* spacing grows with the round so each match sits between the two that feed it */}
            <div className="flex flex-1 flex-col justify-around gap-4">
              {matches.filter((m) => m.round_name === r).sort((a, b) => a.position - b.position).map((m) => <MatchCard key={m.id} m={m} />)}
              {r === 'FINAL' && third && (
                <div>
                  <h4 className="mb-3 mt-6 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">{ROUND_TITLES.THIRD_PLACE}</h4>
                  <MatchCard m={third} />
                </div>
              )}
            </div>
          </div>
        ))}
        {!rounds.includes('FINAL') && third && <MatchCard m={third} />}
      </div>
    </div>
  );
}

export function GroupTable({ group, advance }: { group: Group; advance: number }) {
  return (
    <div className="border border-outline-variant bg-[#151816]">
      <div className="flex items-center justify-between border-b border-outline-variant bg-surface px-4 py-3">
        <h4 className="font-headline-sm uppercase tracking-tighter text-on-surface">{group.name}</h4>
        {group.complete && <span className="font-label-caps text-[9px] uppercase tracking-widest text-primary-container">FINAL</span>}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">
            <th className="px-3 py-2 text-left">Team</th>
            {['P', 'W', 'D', 'L', 'GD', 'PTS'].map((h) => <th key={h} className="px-2 py-2 text-center">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {group.rows.map((r, i) => (
            <tr key={r.team_id} className={`border-t border-outline-variant ${i < advance ? 'bg-primary-container/5' : ''}`}>
              <td className="px-3 py-2">
                <span className={`mr-2 inline-block w-4 text-center font-mono text-xs ${i < advance ? 'text-primary-container' : 'text-on-surface-variant'}`}>{i + 1}</span>
                <span className="font-label-caps text-[11px] uppercase tracking-widest text-on-surface">{r.team_name}</span>
              </td>
              <td className="px-2 py-2 text-center font-mono text-on-surface-variant">{r.played}</td>
              <td className="px-2 py-2 text-center font-mono text-on-surface-variant">{r.won}</td>
              <td className="px-2 py-2 text-center font-mono text-on-surface-variant">{r.drawn}</td>
              <td className="px-2 py-2 text-center font-mono text-on-surface-variant">{r.lost}</td>
              <td className="px-2 py-2 text-center font-mono text-on-surface-variant">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td className="px-2 py-2 text-center font-mono font-bold text-on-surface">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Group tables and knockout bracket for an event; renders nothing for plain leagues. Refreshes on any match change. */
export function TournamentOverview({ eventId }: { eventId: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [bracket, setBracket] = useState<BracketMatch[]>([]);

  const load = useCallback(async () => {
    try {
      const [g, b] = await Promise.all([
        fetch(`/api/v1/events/${eventId}/standings/groups`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/v1/events/${eventId}/bracket`).then((r) => (r.ok ? r.json() : [])),
      ]);
      setGroups(g);
      setBracket(b);
    } catch {
      /* stays on the last good state */
    }
  }, [eventId]);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`tournament-overview:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, load]);

  if (groups.length === 0 && bracket.length === 0) return null;
  // qualifying places per group = highest 'Group X #n' placeholder in the bracket
  const advance = Math.max(0, ...bracket.flatMap((m) => [m.home, m.away]).map((side) => Number(/#(\d+)$/.exec(side.placeholder)?.[1] ?? 0)));

  return (
    <div className="space-y-10">
      {groups.length > 0 && (
        <section>
          <h3 className="mb-4 font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface">Group Stage</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {groups.map((g) => <GroupTable key={g.group_id} group={g} advance={advance} />)}
          </div>
        </section>
      )}
      {bracket.length > 0 && (
        <section>
          <h3 className="mb-4 font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter text-on-surface">Knockout Bracket</h3>
          <BracketView matches={bracket} />
        </section>
      )}
    </div>
  );
}
