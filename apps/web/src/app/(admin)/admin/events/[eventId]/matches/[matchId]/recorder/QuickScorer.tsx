'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { MatchPlayer } from '../useMatchPlayers';
import type { QueuedEvent } from '../useEventQueue';

export type RecordFn = (
  type: string,
  actor: MatchPlayer,
  opts: { target?: MatchPlayer; metadata?: Record<string, any>; x?: number; y?: number; assist?: MatchPlayer; secondsAgo?: number },
  label: string,
) => void;

type Props = {
  players: { home: MatchPlayer[]; away: MatchPlayer[] };
  teams: { homeName: string; awayName: string };
  loading: boolean;
  disabled: boolean;
  elapsed: number; // match clock now, in seconds (for marked moments)
  record: RecordFn;
  items: QueuedEvent[];
  onUndo: (item: QueuedEvent) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
};

type PassKind = 'GROUND' | 'LOFTED' | 'THROUGH_BALL' | 'CROSS';
type OpponentAction = 'TACKLE' | 'INTERCEPTION' | 'BALL_RECOVERY';

// Shot zones in the stored frame: home attacks y=0, away attacks y=100 (mirrored for away).
const ZONES = [
  { id: 'six', label: '6-YARD', x: 50, y: 4, location: 'INSIDE_6YD', style: 'left-[34%] top-[2%] h-[12%] w-[32%]' },
  { id: 'penL', label: 'BOX L', x: 28, y: 11, location: 'PENALTY_AREA', style: 'left-[10%] top-[14%] h-[18%] w-[26%]' },
  { id: 'penC', label: 'BOX', x: 50, y: 12, location: 'PENALTY_AREA', style: 'left-[37%] top-[14%] h-[18%] w-[26%]' },
  { id: 'penR', label: 'BOX R', x: 72, y: 11, location: 'PENALTY_AREA', style: 'left-[64%] top-[14%] h-[18%] w-[26%]' },
  { id: 'outL', label: 'OUT L', x: 22, y: 26, location: 'OUTSIDE_BOX', style: 'left-[5%] top-[34%] h-[22%] w-[30%]' },
  { id: 'outC', label: 'OUT', x: 50, y: 28, location: 'OUTSIDE_BOX', style: 'left-[36%] top-[34%] h-[22%] w-[28%]' },
  { id: 'outR', label: 'OUT R', x: 78, y: 26, location: 'OUTSIDE_BOX', style: 'left-[65%] top-[34%] h-[22%] w-[30%]' },
  { id: 'far', label: 'LONG RANGE', x: 50, y: 45, location: 'HALF_WAY', style: 'left-[5%] top-[58%] h-[22%] w-[90%]' },
];

const onPitch = (list: MatchPlayer[]) => {
  const lineup = list.some((p) => p.participationStatus !== null);
  return list.filter((p) => (lineup ? ['STARTER', 'SUBBED_IN'].includes(p.participationStatus as string) : !['SUBBED_OUT', 'SENT_OFF'].includes(p.participationStatus as string)));
};

const readPref = <T extends string>(k: string, fallback: T): T => {
  try { return (localStorage.getItem(k) as T) || fallback; } catch { return fallback; }
};
const writePref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

const STATUS_STYLE: Record<QueuedEvent['status'], string> = {
  saved: 'text-primary-container',
  sending: 'text-on-surface-variant',
  queued: 'text-[#ffd479]',
  failed: 'text-error',
};

export function QuickScorer({ players, teams, loading, disabled, elapsed, record: sendRecord, items, onUndo, onRetry, onDiscard }: Props) {
  const [holder, setHolder] = useState<MatchPlayer | null>(null);
  const [lastPass, setLastPass] = useState<{ from: MatchPlayer; to: MatchPlayer; at: number } | null>(null);
  const [passKind, setPassKind] = useState<PassKind>('GROUND');
  const [opponentAction, setOpponentAction] = useState<OpponentAction>(() => readPref<OpponentAction>('rec_opp_action', 'TACKLE'));
  const [askLocation, setAskLocation] = useState(() => readPref<'yes' | 'no'>('rec_ask_location', 'no') === 'yes'); // one tap fewer per shot by default
  const [focus, setFocus] = useState<'both' | 'home' | 'away'>(() => readPref<'both' | 'home' | 'away'>('rec_focus', 'both'));
  const [ago, setAgo] = useState(0); // back-date the next event by this many seconds
  const [marks, setMarks] = useState<number[]>([]); // clock readings of moments flagged to fill in later
  const [activeMark, setActiveMark] = useState<number | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [pendingShot, setPendingShot] = useState<{ result: string; label: string } | null>(null);

  const squads = { home: onPitch(players.home), away: onPitch(players.away) };

  // every recorded event: honours a back-date or a marked moment (then forgets it) and buzzes so the recorder can trust the tap
  const record: RecordFn = (type, actor, opts, label) => {
    const secondsAgo = activeMark !== null ? Math.max(0, elapsed - activeMark) : ago;
    try { navigator.vibrate?.(12); } catch { /* not supported */ }
    sendRecord(type, actor, { ...opts, secondsAgo }, label);
    if (activeMark !== null) { setMarks((m) => m.filter((x) => x !== activeMark)); setActiveMark(null); }
    setAgo(0);
  };
  const [keySide, setKeySide] = useState<'home' | 'away'>('home');
  const latest = useRef<any>({});

  const short = (p: MatchPlayer) => `#${p.jersey_number ?? '?'} ${p.name}`;

  const tapPlayer = (p: MatchPlayer) => {
    if (disabled) return;
    if (!holder) return setHolder(p);
    if (holder.id === p.id) return setHolder(null);

    if (holder.team === p.team) {
      const isCross = passKind === 'CROSS';
      record(isCross ? 'CROSS' : 'PASS', holder, {
        target: p,
        metadata: isCross ? { result: 'COMPLETED' } : { result: 'COMPLETED', type: passKind },
      }, `${isCross ? 'Cross' : 'Pass'} ${short(holder)} to ${short(p)}`);
      setLastPass({ from: holder, to: p, at: Date.now() });
      setPassKind('GROUND');
    } else {
      // the opponent takes the ball: tackle / interception / recovery by them, against the holder
      record(opponentAction, p, opponentAction === 'BALL_RECOVERY' ? {} : {
        target: holder,
        metadata: opponentAction === 'TACKLE' ? { result: 'WON_RETAINED' } : {},
      }, `${opponentAction.replace('_', ' ').toLowerCase()} ${short(p)} v ${short(holder)}`);
      setLastPass(null);
    }
    setHolder(p);
  };

  const doShot = (result: string, label: string, location?: { x: number; y: number; location: string }) => {
    if (!holder) return;
    const assist = result === 'GOAL' && lastPass && lastPass.to.id === holder.id && Date.now() - lastPass.at < 20000 ? lastPass.from : undefined;
    // zones are drawn for the top goal; the away side attacks the opposite end
    const flip = holder.team === 'away';
    record('SHOT', holder, {
      metadata: { result, ...(location ? { location: location.location } : {}) },
      x: location ? (flip ? 100 - location.x : location.x) : undefined,
      y: location ? (flip ? 100 - location.y : location.y) : undefined,
      assist,
    }, `${label} ${short(holder)}${assist ? ` (assist ${short(assist)})` : ''}`);
    if (result === 'SAVED') {
      // a saved shot is also a goalkeeper save: log it so keeper stats are not empty
      const defenders = squads[holder.team === 'home' ? 'away' : 'home'];
      const keeper = defenders.find((p) => p.position === 'GK') ?? defenders.find((p) => p.jersey_number === 1) ?? defenders[0];
      if (keeper) record('SAVE', keeper, { metadata: {} }, `Save ${short(keeper)}`);
    }
    setHolder(null);
    setLastPass(null);
    setPendingShot(null);
  };

  const shoot = (result: string, label: string) => {
    if (!holder) return;
    if (askLocation) setPendingShot({ result, label });
    else doShot(result, label);
  };

  const simple = (type: string, label: string, metadata: Record<string, any> = {}, keep = true) => {
    if (!holder) return;
    record(type, holder, { metadata }, `${label} ${short(holder)}`);
    if (!keep) setHolder(null);
  };


  // Keyboard mode for laptops and tablets: type a shirt number to pick a player, one letter for the action.
  latest.current = { tapPlayer, doShot, simple, holder, keySide, squads, focus, items, onUndo, disabled, elapsed };
  useEffect(() => {
    let buffer = '';
    let timer: ReturnType<typeof setTimeout> | null = null;
    const commit = () => {
      const L = latest.current;
      const n = parseInt(buffer, 10);
      buffer = '';
      const side = L.focus !== 'both' ? L.focus : L.keySide;
      const p = L.squads[side].find((x: MatchPlayer) => x.jersey_number === n);
      if (p) L.tapPlayer(p);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      const L = latest.current;
      if (L.disabled) return;
      const k = e.key.toLowerCase();
      if (/^[0-9]$/.test(k)) {
        buffer += k;
        if (timer) clearTimeout(timer);
        if (buffer.length >= 2) commit(); else timer = setTimeout(commit, 600);
        e.preventDefault();
        return;
      }
      const act: Record<string, () => void> = {
        h: () => { if (L.focus === 'both') setKeySide('home'); },
        a: () => { if (L.focus === 'both') setKeySide('away'); },
        ' ': () => setHolder(null),
        escape: () => setHolder(null),
        g: () => L.doShot('GOAL', 'GOAL'),
        s: () => L.doShot('SAVED', 'Shot saved'),
        o: () => L.doShot('OFF_TARGET', 'Shot off target'),
        b: () => L.doShot('BLOCKED', 'Shot blocked'),
        d: () => L.simple('DRIBBLE', 'Dribble', { result: 'SUCCESS' }),
        c: () => L.simple('CLEARANCE', 'Clearance', {}, false),
        k: () => L.simple('SAVE', 'Save', {}),
        u: () => { const last = [...L.items].reverse().find((i: QueuedEvent) => i.status !== 'failed'); if (last) L.onUndo(last); },
        m: () => setMarks((m) => [...m, L.elapsed].slice(-6)),
      };
      if (act[k]) { act[k](); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (timer) clearTimeout(timer); };
  }, []);

  const recent = [...items].reverse().slice(0, 6);
  const unsent = items.filter((i) => i.status === 'queued' || i.status === 'sending').length;
  const act = 'py-3 font-label-caps text-[11px] uppercase tracking-widest transition-colors disabled:opacity-30 disabled:pointer-events-none';
  const outline = `border border-outline-variant bg-surface text-on-surface hover:bg-surface-variant ${act}`;

  const roster = (side: 'home' | 'away', name: string) => (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className={`font-label-caps text-[10px] uppercase tracking-widest ${side === 'home' ? 'text-primary-container' : 'text-on-surface'}`}>{name}</span>
        <span className="font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">{side === 'home' ? 'HOME' : 'AWAY'}</span>
      </div>
      <div className={`grid gap-2 ${squads[side].length > 8 ? 'grid-cols-6' : 'grid-cols-4'}`}>
        {squads[side].map((p) => {
          const active = holder?.id === p.id;
          const teammate = holder && holder.team === side && !active;
          return (
            <button
              key={p.id}
              onClick={() => tapPlayer(p)}
              disabled={disabled}
              aria-pressed={active}
              aria-label={`${side === 'home' ? 'Home' : 'Away'} ${short(p)}`}
              className={`flex min-h-[56px] flex-col items-center justify-center border px-1 py-2 transition-colors disabled:opacity-40 ${
                active ? 'border-primary-container bg-primary-container text-on-primary-container' : teammate ? 'border-primary-container/50 bg-surface-variant' : 'border-outline-variant bg-surface hover:bg-surface-variant'
              }`}
            >
              <span className="font-mono text-xl font-bold leading-none">{p.jersey_number ?? '-'}</span>
              <span className="mt-1 w-full truncate text-center text-[9px] leading-tight opacity-80">{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (loading) return <p className="py-8 text-center text-sm text-on-surface-variant">Loading squads...</p>;

  return (
    <div className="mt-4 space-y-4">
      {unsent > 0 && (
        <div role="status" className="border border-[#ffd479] bg-[#ffd479]/10 px-3 py-2 font-label-caps text-[10px] uppercase tracking-widest text-[#ffd479]">
          {unsent} event{unsent > 1 ? 's' : ''} waiting to sync. Keep scoring, they will upload when the connection is back.
        </div>
      )}

      {/* what is happening right now */}
      <div className="border border-outline-variant bg-[#151816] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">BALL WITH</div>
            <div className="truncate font-headline-sm uppercase tracking-tighter text-on-surface">{holder ? short(holder) : 'Tap a player to start'}</div>
          </div>
          <button onClick={() => setHolder(null)} disabled={!holder} className="shrink-0 border border-outline-variant px-3 py-2 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant disabled:opacity-30">LOST BALL</button>
        </div>
        {!holder && items.length === 0 && (
          <p className="mt-2 text-[11px] leading-snug text-on-surface-variant">
            Tap the player with the ball. Tap a teammate to log a pass, an opponent to log them winning it. Shots and other actions are in the bar below.
          </p>
        )}
      </div>

      {/* speed tools stay folded away until needed so the squads keep the screen */}
      <button onClick={() => setToolsOpen((v) => !v)} aria-expanded={toolsOpen}
        className={`flex w-full items-center justify-between border px-3 py-2 font-label-caps text-[10px] uppercase tracking-widest ${ago || activeMark !== null || marks.length ? 'border-[#ffd479] text-[#ffd479]' : 'border-outline-variant text-on-surface-variant'}`}>
        <span>Recording: {focus === 'both' ? 'both teams' : focus === 'home' ? teams.homeName : teams.awayName} · Time: {activeMark !== null ? 'flagged moment' : ago ? `-${ago}s` : 'now'}{marks.length ? ` · ${marks.length} flag${marks.length > 1 ? 's' : ''}` : ''}</span>
        <span>{toolsOpen ? 'Hide' : 'Tools'}</span>
      </button>
      {toolsOpen && (
      <div className="space-y-2">
        <div className="flex items-center gap-1" role="group" aria-label="Recording focus">
          <span className="mr-1 shrink-0 font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">RECORDING</span>
          {([['both', 'BOTH'], ['home', teams.homeName], ['away', teams.awayName]] as ['both' | 'home' | 'away', string][]).map(([f, label]) => (
            <button key={f} onClick={() => { setFocus(f); writePref('rec_focus', f); setHolder(null); if (f !== 'both') setKeySide(f); }} aria-pressed={focus === f}
              className={`min-w-0 flex-1 truncate border px-2 py-2 font-label-caps text-[9px] uppercase tracking-widest ${focus === f ? 'border-primary-container bg-primary-container/15 text-primary-container' : 'border-outline-variant text-on-surface-variant'}`}>{label}</button>
          ))}
        </div>
        {focus !== 'both' && <p className="text-[10px] leading-snug text-on-surface-variant">Two people can record: one phone per team. Each logs their own side; the score and stats merge automatically.</p>}
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="When it happened">
          <span className="mr-1 shrink-0 font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">HAPPENED</span>
          {[0, 5, 10, 20].map((n) => (
            <button key={n} onClick={() => { setAgo(n); setActiveMark(null); }} aria-pressed={activeMark === null && ago === n}
              className={`border px-3 py-2 font-label-caps text-[10px] uppercase tracking-widest ${activeMark === null && ago === n ? 'border-primary-container bg-primary-container/15 text-primary-container' : 'border-outline-variant text-on-surface-variant'}`}>{n === 0 ? 'NOW' : `-${n}s`}</button>
          ))}
          <button onClick={() => setMarks((m) => [...m, elapsed].slice(-6))} className="border border-outline-variant px-3 py-2 font-label-caps text-[10px] uppercase tracking-widest text-on-surface">FLAG</button>
          {marks.map((mk) => (
            <button key={mk} onClick={() => setActiveMark(activeMark === mk ? null : mk)} aria-pressed={activeMark === mk}
              className={`border px-2 py-2 font-mono text-[10px] ${activeMark === mk ? 'border-[#ffd479] bg-[#ffd479]/15 text-[#ffd479]' : 'border-outline-variant text-on-surface-variant'}`}>{String(Math.floor(mk / 60)).padStart(2, '0')}:{String(mk % 60).padStart(2, '0')}</button>
          ))}
        </div>
        {(marks.length > 0 || activeMark !== null) && <p className="text-[10px] leading-snug text-on-surface-variant">FLAG saves this moment while play goes on. Later tap the flag, then record the event: it is stamped with the flagged time.</p>}
      </div>
      )}

      {/* next-tap modifiers */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1" role="group" aria-label="Next pass type">
          {([['GROUND', 'PASS'], ['LOFTED', 'LOFTED'], ['THROUGH_BALL', 'THROUGH'], ['CROSS', 'CROSS']] as [PassKind, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setPassKind(k)} aria-pressed={passKind === k}
              className={`py-2 font-label-caps text-[10px] uppercase tracking-widest border ${passKind === k ? 'border-primary-container bg-primary-container/15 text-primary-container' : 'border-outline-variant text-on-surface-variant'}`}>{l}</button>
          ))}
        </div>
        {focus === 'both' && (<div className="flex items-center gap-2" role="group" aria-label="Opponent tap logs">
          <span className="shrink-0 font-label-caps text-[9px] uppercase tracking-widest text-on-surface-variant">OPPONENT TAP =</span>
          {([['TACKLE', 'TACKLE'], ['INTERCEPTION', 'INTERCEPT'], ['BALL_RECOVERY', 'RECOVERY']] as [OpponentAction, string][]).map(([k, l]) => (
            <button key={k} onClick={() => { setOpponentAction(k); writePref('rec_opp_action', k); }} aria-pressed={opponentAction === k}
              className={`flex-1 py-2 font-label-caps text-[9px] uppercase tracking-widest border ${opponentAction === k ? 'border-primary-container bg-primary-container/15 text-primary-container' : 'border-outline-variant text-on-surface-variant'}`}>{l}</button>
          ))}
        </div>)}
      </div>

      {focus !== 'away' && roster('home', teams.homeName)}
      {focus !== 'home' && roster('away', teams.awayName)}

      <label className="flex items-center justify-between gap-3 text-[11px] text-on-surface-variant">
        Ask shot location (one extra tap, powers the shot map)
        <input type="checkbox" checked={askLocation} className="h-4 w-4 accent-[#39ff6a]"
          onChange={(e) => { setAskLocation(e.target.checked); writePref('rec_ask_location', e.target.checked ? 'yes' : 'no'); }} />
      </label>

      <div className="text-[10px] text-on-surface-variant">
        <button onClick={() => setKeysOpen((v) => !v)} aria-expanded={keysOpen} className="font-label-caps text-[10px] uppercase tracking-widest underline">Keyboard shortcuts</button>
        {keysOpen && (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border border-outline-variant p-3 leading-snug">
            <span>Type a shirt number: pick that player ({focus === 'both' ? keySide : focus})</span><span>H / A: switch side for numbers</span>
            <span>Number, then another number: pass</span><span>G goal, S saved, O off target, B blocked</span>
            <span>D dribble, C clearance, K keeper save</span><span>Space or Esc: lost ball</span>
            <span>U: undo last event</span><span>M: flag this moment</span>
          </div>
        )}
      </div>

      {/* what was just recorded */}
      <div>
        <h3 className="mb-2 font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">Just recorded</h3>
        <ul className="divide-y divide-outline-variant border border-outline-variant">
          {recent.length === 0 && <li className="px-3 py-3 text-xs text-on-surface-variant">Nothing yet.</li>}
          {recent.map((it, i) => (
            <li key={it.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs text-on-surface">{it.label}</div>
                <div className={`font-label-caps text-[9px] uppercase tracking-widest ${STATUS_STYLE[it.status]}`}>
                  {it.status === 'saved' ? 'Saved' : it.status === 'sending' ? 'Sending...' : it.status === 'queued' ? (it.error || 'Waiting') : `Not saved: ${it.error}`}
                </div>
              </div>
              <div className="flex shrink-0 gap-3 font-label-caps text-[10px] uppercase tracking-widest">
                {it.status === 'failed' && <button onClick={() => onRetry(it.id)} className="text-primary-container">Retry</button>}
                {(i === 0 || it.status === 'failed') && <button onClick={() => (it.status === 'failed' ? onDiscard(it.id) : onUndo(it))} className="text-error">{it.status === 'failed' ? 'Discard' : 'Undo'}</button>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* actions for the player holding the ball: pinned so the recorder never scrolls to find them */}
      <div className={`sticky bottom-0 z-40 -mx-4 border-t border-outline-variant bg-background/95 px-4 pb-3 pt-2 backdrop-blur ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-4 gap-2">
          <button disabled={!holder} onClick={() => shoot('GOAL', 'GOAL')} className={`col-span-4 bg-primary-container text-on-primary-container hover:bg-primary-fixed ${act} py-3 text-sm font-bold`}>GOAL</button>
          <button disabled={!holder} onClick={() => shoot('SAVED', 'Shot saved')} className={outline}>SAVED</button>
          <button disabled={!holder} onClick={() => shoot('OFF_TARGET', 'Shot off target')} className={outline}>OFF</button>
          <button disabled={!holder} onClick={() => shoot('BLOCKED', 'Shot blocked')} className={outline}>BLOCK</button>
          <button disabled={!holder} onClick={() => simple('DRIBBLE', 'Dribble', { result: 'SUCCESS' })} className={outline}>DRIBBLE</button>
          <button disabled={!holder} onClick={() => simple('CLEARANCE', 'Clearance', {}, false)} className={`${outline} col-span-2`}>CLEARANCE</button>
          <button disabled={!holder} onClick={() => simple('SAVE', 'Save', {})} className={`${outline} col-span-2`}>GK SAVE</button>
        </div>
      </div>

      {pendingShot && holder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" role="dialog" aria-label="Shot location">
          <div className="w-full max-w-md border border-outline-variant bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-headline-sm uppercase tracking-tighter text-on-surface">{pendingShot.label}: where from?</h3>
              <button onClick={() => doShot(pendingShot.result, pendingShot.label)} className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant underline">Skip</button>
            </div>
            {/* goal is at the top, the shooter's team attacks upward */}
            <div className="relative mx-auto aspect-[4/3] w-full border border-white/60 bg-[#2E7D32]">
              <div className="absolute left-[30%] top-0 h-[2%] w-[40%] bg-white/80" />
              <div className="absolute left-[18%] top-0 h-[32%] w-[64%] border border-white/60 border-t-0" />
              <div className="absolute left-[36%] top-0 h-[12%] w-[28%] border border-white/60 border-t-0" />
              {ZONES.map((z) => (
                <button key={z.id} onClick={() => doShot(pendingShot.result, pendingShot.label, z)}
                  className={`absolute ${z.style} flex items-center justify-center border border-white/30 bg-black/10 font-label-caps text-[9px] uppercase tracking-widest text-white hover:bg-white/25`}>{z.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
