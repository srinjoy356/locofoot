'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiJson } from '@/lib/api';

type Option = { key: string; label: string; odds: number | null };
type Market = { id: string; kind: 'MATCH_RESULT' | 'NEXT_GOAL' | 'TOTAL_GOALS'; params: Record<string, any>; status: 'OPEN' | 'SETTLED' | 'VOID'; result: string | null; options: Option[] };
type Bet = { id: string; market_id: string; selection: string; stake: number; odds: number; status: 'PENDING' | 'WON' | 'LOST' | 'VOID'; payout: number };
type Board = {
  match: { home: string | null; away: string | null; home_score: number; away_score: number; state: string; minute: number | null };
  markets: Market[];
  suspended: { reason: string; permanent?: boolean } | null;
  eligible: { ok: boolean; reason?: string };
  my_bets: Bet[];
  max_stake: number;
};

const TITLES: Record<string, (m: Market) => string> = {
  MATCH_RESULT: () => 'Who wins?',
  NEXT_GOAL: (m) => (m.params.goal_no === 1 ? 'First goal' : `Goal ${m.params.goal_no}`),
  TOTAL_GOALS: (m) => `Total goals, line ${m.params.line}`,
};
const STAKES = [10, 25, 50, 100];

export const optionLabel = (markets: Market[], marketId: string, key: string) =>
  markets.find((m) => m.id === marketId)?.options.find((o) => o.key === key)?.label ?? key;

export function PredictionPanel({ matchId }: { matchId: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [wallet, setWallet] = useState<{ balance: number; can_refill: boolean } | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [slip, setSlip] = useState<{ market: Market; option: Option; stake: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'warn' | 'bad'; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    setSignedIn(!!session);
    const [b, w] = await Promise.all([
      apiJson<Board>(`/api/v1/predictions/matches/${matchId}`),
      session ? apiJson(`/api/v1/predictions/wallet`) : Promise.resolve(null),
    ]);
    if (b.ok) setBoard(b.data);
    if (w && w.ok) setWallet(w.data as any);
  }, [matchId]);

  // refetch shortly after any change; bursts of events collapse into one request
  const refreshSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 350);
  }, [load]);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase.channel(`predict:${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_timeline_events', filter: `match_id=eq.${matchId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_markets', filter: `match_id=eq.${matchId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets', filter: `match_id=eq.${matchId}` }, refreshSoon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_wallets' }, refreshSoon)
      .subscribe();
    const poll = setInterval(load, 8000); // odds drift with the clock even when nothing is recorded
    return () => { clearInterval(poll); if (timer.current) clearTimeout(timer.current); supabase.removeChannel(channel); };
  }, [matchId, load, refreshSoon]);

  // keep the open slip's price current when the board refreshes
  useEffect(() => {
    if (!slip || !board) return;
    const m = board.markets.find((x) => x.id === slip.market.id);
    const o = m?.options.find((x) => x.key === slip.option.key);
    if (!m || m.status !== 'OPEN' || !o || o.odds === null) { setSlip(null); return; }
    if (o.odds !== slip.option.odds) setSlip({ market: m, option: o, stake: slip.stake });
  }, [board]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = async () => {
    if (!slip || !slip.option.odds) return;
    setBusy(true);
    setNote(null);
    const res = await apiJson(`/api/v1/predictions/matches/${matchId}/bets`, {
      method: 'POST',
      body: JSON.stringify({ market_id: slip.market.id, selection: slip.option.key, stake: slip.stake, odds: slip.option.odds, idempotency_key: crypto.randomUUID() }),
    });
    setBusy(false);
    if (res.ok) {
      setNote({ tone: 'ok', text: `Prediction placed. A win pays ${res.data.potential_payout} coins.` });
      setSlip(null);
    } else {
      const d = (res.data as any)?.detail;
      const code = d?.code;
      if (code === 'ODDS_CHANGED') setNote({ tone: 'warn', text: `The odds moved to ${d.odds}. Check the new price and confirm again.` });
      else setNote({ tone: 'bad', text: d?.message || (Array.isArray(d) ? 'Please check your stake.' : 'Could not place the prediction.') });
    }
    load();
  };

  const refill = async () => {
    const res = await apiJson(`/api/v1/predictions/wallet/refill`, { method: 'POST' });
    setNote(res.ok ? { tone: 'ok', text: 'Here are 300 fresh coins.' } : { tone: 'bad', text: (res.data as any)?.detail?.message || 'Refill not available.' });
    load();
  };

  if (!board) return <div className="border border-outline-variant bg-surface p-6 text-sm text-on-surface-variant">Loading predictions...</div>;

  const frozen = board.suspended;
  const canBet = signedIn && board.eligible.ok && !frozen;
  const stakeMax = Math.max(1, Math.min(board.max_stake, wallet?.balance ?? board.max_stake));

  return (
    <section aria-label="Predictions" className="border border-outline-variant bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-surface-container px-4 py-3">
        <div>
          <h3 className="font-headline-sm uppercase tracking-tighter text-on-surface">Predict the match</h3>
          <p className="font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">Free game, virtual coins only. No real money.</p>
        </div>
        {signedIn && wallet ? (
          <div className="flex items-center gap-3">
            <span className="border border-primary-container/40 px-3 py-1 font-mono text-sm text-primary-container" aria-label="Coin balance">{wallet.balance} coins</span>
            {wallet.can_refill && <button onClick={refill} className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface underline">Get 300 more</button>}
          </div>
        ) : (
          <Link href="/login" className="border border-primary-container px-3 py-2 font-label-caps text-[10px] uppercase tracking-widest text-primary-container hover:bg-primary-container hover:text-on-primary-container">
            Sign in to predict
          </Link>
        )}
      </div>

      {frozen && (
        <div role="status" className={`border-b px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest ${frozen.permanent ? 'border-outline-variant text-on-surface-variant' : 'border-[#ffd479]/50 bg-[#ffd479]/10 text-[#ffd479]'}`}>
          {frozen.permanent ? 'Predictions closed' : `Predictions paused: ${frozen.reason}`}
        </div>
      )}
      {signedIn && !board.eligible.ok && <div className="border-b border-outline-variant px-4 py-2 text-xs text-on-surface-variant">{board.eligible.reason}</div>}
      {note && <div role="status" className={`border-b border-outline-variant px-4 py-2 text-sm ${note.tone === 'ok' ? 'text-primary-container' : note.tone === 'warn' ? 'text-[#ffd479]' : 'text-error'}`}>{note.text}</div>}

      <div className="divide-y divide-outline-variant">
        {board.markets.map((m) => (
          <div key={m.id} className="px-4 py-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface">{TITLES[m.kind](m)}</span>
              {m.status !== 'OPEN' && <span className="font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">{m.status === 'VOID' ? 'Refunded' : 'Settled'}</span>}
            </div>
            <div className={`grid gap-2 ${m.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {m.options.map((o) => {
                const selected = slip?.market.id === m.id && slip.option.key === o.key;
                const won = m.status === 'SETTLED' && m.result === o.key;
                const disabled = m.status !== 'OPEN' || o.odds === null || !canBet;
                return (
                  <button
                    key={o.key}
                    disabled={disabled}
                    aria-pressed={selected}
                    onClick={() => { setNote(null); setSlip({ market: m, option: o, stake: Math.min(25, stakeMax) }); }}
                    className={`flex flex-col items-center gap-1 border px-2 py-3 text-center transition-colors disabled:cursor-not-allowed ${
                      selected ? 'border-primary-container bg-primary-container/15' : won ? 'border-primary-container/60 bg-primary-container/5' : 'border-outline-variant hover:bg-surface-variant disabled:hover:bg-transparent'
                    } ${disabled && !won ? 'opacity-60' : ''}`}
                  >
                    <span className="line-clamp-1 text-xs text-on-surface">{o.label}</span>
                    <span className="font-mono text-lg font-bold tabular-nums text-primary-container">{m.status === 'OPEN' ? (o.odds ?? '-') : won ? 'WON' : ''}</span>
                  </button>
                );
              })}
            </div>

            {slip?.market.id === m.id && slip.option.odds && (
              <div className="mt-3 border border-primary-container/40 bg-primary-container/5 p-3">
                <div className="mb-2 text-xs text-on-surface">{slip.option.label} at <span className="font-mono text-primary-container">{slip.option.odds}</span></div>
                <div className="flex flex-wrap items-center gap-2">
                  {STAKES.filter((s) => s <= stakeMax).map((s) => (
                    <button key={s} onClick={() => setSlip({ ...slip, stake: s })} aria-pressed={slip.stake === s}
                      className={`px-3 py-1 font-mono text-sm border ${slip.stake === s ? 'border-primary-container text-primary-container' : 'border-outline-variant text-on-surface-variant'}`}>{s}</button>
                  ))}
                  <button onClick={() => setSlip({ ...slip, stake: stakeMax })} className="border border-outline-variant px-3 py-1 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Max</button>
                  <input aria-label="Stake" type="number" min={1} max={stakeMax} value={slip.stake}
                    onChange={(e) => setSlip({ ...slip, stake: Math.max(1, Math.min(stakeMax, Number(e.target.value) || 1)) })}
                    className="w-20 border border-outline-variant bg-background px-2 py-1 text-center font-mono text-sm text-on-surface" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-on-surface-variant">A win pays <span className="font-mono text-on-surface">{Math.floor(slip.stake * slip.option.odds)}</span> coins</span>
                  <div className="flex gap-2">
                    <button onClick={() => setSlip(null)} className="px-3 py-2 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Cancel</button>
                    <button onClick={place} disabled={busy} className="bg-primary-container px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest text-on-primary-container disabled:opacity-50">
                      {busy ? 'Placing...' : 'Place prediction'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {board.my_bets.length > 0 && (
        <div className="border-t border-outline-variant px-4 py-3">
          <h4 className="mb-2 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Your predictions on this match</h4>
          <ul className="space-y-1">
            {board.my_bets.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-on-surface">{optionLabel(board.markets, b.market_id, b.selection)} <span className="font-mono text-on-surface-variant">{b.stake} @ {b.odds}</span></span>
                <span className={`font-label-caps text-[10px] uppercase tracking-widest ${b.status === 'WON' ? 'text-primary-container' : b.status === 'LOST' ? 'text-error' : 'text-on-surface-variant'}`}>
                  {b.status === 'WON' ? `Won ${b.payout}` : b.status === 'LOST' ? 'Lost' : b.status === 'VOID' ? 'Refunded' : 'Pending'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
