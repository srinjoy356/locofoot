'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiJson } from '@/lib/api';
import { TurfHero } from '@/components/shared/TurfHero';
import { LeaderboardTable } from '@/components/predictions/LeaderboardTable';

type HubMatch = { match_id: string; event_name: string; event_slug: string | null; event_id: string; home: string; away: string; home_score: number; away_score: number; state: string; scheduled_start: string | null; live: boolean };
type MyBet = { id: string; selection: string; stake: number; odds: number; status: string; payout: number; created_at: string; match: { home: string | null; away: string | null; home_score: number; away_score: number; state: string }; market: { kind: string; params: Record<string, any> } };

const kindLabel = (b: MyBet) => (b.market.kind === 'MATCH_RESULT' ? 'Result' : b.market.kind === 'NEXT_GOAL' ? `Goal ${b.market.params?.goal_no ?? ''}` : `Total goals ${b.market.params?.line ?? ''}`);
const pick = (b: MyBet) => ({ HOME: b.match.home, AWAY: b.match.away, DRAW: 'Draw', NONE: 'No more goals', OVER: 'Over', UNDER: 'Under' } as Record<string, string | null>)[b.selection] ?? b.selection;

export default function PredictHubPage() {
  const [matches, setMatches] = useState<HubMatch[] | null>(null);
  const [wallet, setWallet] = useState<{ balance: number; can_refill: boolean } | null>(null);
  const [mine, setMine] = useState<MyBet[]>([]);
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    setMe(session?.user.id ?? null);
    const live = await apiJson<HubMatch[]>('/api/v1/predictions/live');
    if (live.ok) setMatches(live.data);
    if (session) {
      const [w, b] = await Promise.all([apiJson('/api/v1/predictions/wallet'), apiJson<MyBet[]>('/api/v1/predictions/bets/me?limit=15')]);
      if (w.ok) setWallet(w.data as any);
      if (b.ok) setMine(b.data);
    }
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase.channel('predict-hub')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => load())
      .subscribe();
    const poll = setInterval(load, 15000);
    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [load]);

  return (
    <div className="flex w-full flex-col bg-background text-on-surface">
      <TurfHero eyebrow="Free to play" title={<>Match <span className="text-primary-container">Predictions</span></>} subtitle="Call the next goal, the winner and the total goals while the game is live. Win coins, climb the board. No real money, ever." image="/turf/aerial-goal.jpg" size="sm" />

      <div className="mx-auto grid w-full max-w-container-max gap-8 px-margin-mobile py-8 md:px-gutter lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="mb-4 font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter">Live now and kicking off soon</h2>
            {!matches ? <p className="text-sm text-on-surface-variant">Loading matches...</p> : matches.length === 0 ? (
              <div className="border border-outline-variant bg-surface p-8 text-center text-sm text-on-surface-variant">No matches are open for predictions right now. Check back at kick-off.</div>
            ) : (
              <ul className="space-y-3">
                {matches.map((m) => (
                  <li key={m.match_id}>
                    <Link href={`/events/${m.event_slug || m.event_id}/matches/${m.match_id}`} className="flex items-center justify-between gap-4 border border-outline-variant bg-surface p-4 transition-colors hover:bg-surface-variant">
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2 font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">
                          {m.live ? <span className="flex items-center gap-1 text-error"><span className="h-2 w-2 animate-pulse rounded-full bg-error" />Live</span> : <span>{m.scheduled_start ? new Date(m.scheduled_start).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'Scheduled'}</span>}
                          <span className="truncate">{m.event_name}</span>
                        </div>
                        <div className="truncate font-headline-sm uppercase tracking-tighter">{m.home} <span className="text-on-surface-variant">vs</span> {m.away}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        {(m.live || m.home_score + m.away_score > 0) && <span className="font-mono text-2xl font-bold tabular-nums">{m.home_score} - {m.away_score}</span>}
                        <span className="border border-primary-container px-3 py-2 font-label-caps text-[10px] uppercase tracking-widest text-primary-container">Predict</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {me && (
            <section>
              <h2 className="mb-4 font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tighter">Your recent predictions</h2>
              {mine.length === 0 ? <p className="text-sm text-on-surface-variant">You have not predicted anything yet. Open a live match above.</p> : (
                <ul className="divide-y divide-outline-variant border border-outline-variant bg-surface">
                  {mine.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate text-on-surface">{kindLabel(b)}: <strong>{pick(b)}</strong> <span className="font-mono text-on-surface-variant">{b.stake} @ {b.odds}</span></div>
                        <div className="truncate text-xs text-on-surface-variant">{b.match.home} {b.match.home_score}-{b.match.away_score} {b.match.away}</div>
                      </div>
                      <span className={`shrink-0 font-label-caps text-[10px] uppercase tracking-widest ${b.status === 'WON' ? 'text-primary-container' : b.status === 'LOST' ? 'text-error' : 'text-on-surface-variant'}`}>
                        {b.status === 'WON' ? `+${b.payout - b.stake}` : b.status === 'LOST' ? `-${b.stake}` : b.status === 'VOID' ? 'Refunded' : 'Pending'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <div className="border border-outline-variant bg-surface p-5">
            {me && wallet ? (
              <>
                <div className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Your coins</div>
                <div className="mt-1 font-mono text-4xl font-bold text-primary-container" aria-label="Coin balance">{wallet.balance}</div>
                <p className="mt-2 text-xs text-on-surface-variant">New players start with 1000 coins. Run out and you can claim 300 more once a day.</p>
              </>
            ) : (
              <>
                <div className="font-headline-sm uppercase tracking-tighter">Join the game</div>
                <p className="mt-2 text-sm text-on-surface-variant">Create a free account to get 1000 starter coins and appear on the leaderboard.</p>
                <div className="mt-4 flex gap-2">
                  <Link href="/register" className="flex-1 bg-primary-container py-3 text-center font-label-caps text-[10px] uppercase tracking-widest text-on-primary-container">Create account</Link>
                  <Link href="/login" className="flex-1 border border-outline-variant py-3 text-center font-label-caps text-[10px] uppercase tracking-widest">Sign in</Link>
                </div>
              </>
            )}
          </div>

          <div className="border border-outline-variant bg-surface">
            <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container px-4 py-3">
              <h2 className="font-headline-sm uppercase tracking-tighter">Leaderboard</h2>
              <Link href="/predict/leaderboard" className="font-label-caps text-[10px] uppercase tracking-widest text-primary-container">Full table</Link>
            </div>
            <LeaderboardTable limit={10} meId={me} />
          </div>
        </aside>
      </div>
    </div>
  );
}
