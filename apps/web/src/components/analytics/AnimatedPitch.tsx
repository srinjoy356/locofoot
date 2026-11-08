'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { clamp, getInitials, goalMouth, jitter, layoutTeam, separate, toScreen, type Possession, type Pt } from '@/lib/pitchUtils';

type PitchActor = {
  id?: string | null;
  name?: string | null;
  team?: 'home' | 'away';
  jersey_number?: number | null;
  position?: string | null;
};

type PitchEvent = {
  id: string;
  type: string;
  actor?: PitchActor;
  target?: PitchActor;
  minute: number;
  result?: string | null;
  metadata?: Record<string, any> | null;
};

type Props = {
  activeEvent: PitchEvent | null;
  homeStarters?: any[];
  awayStarters?: any[];
  homeSubs?: any[];
  awaySubs?: any[];
};

type Override = { pos?: Pt; scale?: number; rotate?: number; opacity?: number; glow?: boolean; dur?: number };
type Flight = { id: number; height: number; dur: number };

const KIT = { home: '#2f6bff', away: '#ff8a1f', homeGk: '#f5d90a', awayGk: '#b455ff' };
const PASS_LIKE = new Set(['PASS', 'DISTRIBUTION', 'ASSIST', 'CROSS', 'LONG_BALL', 'THROUGH_BALL']);
const DUEL_LIKE = new Set(['TACKLE', 'INTERCEPTION', 'BLOCK', 'AERIAL_DUEL', 'AERIAL_CLAIM', 'FOUL']);
const CARRY_LIKE = new Set(['DRIBBLE', 'OFF_BALL_RUN', 'GREAT_FIRST_TOUCH', 'BALL_RECOVERY']);

/** Keeper first (explicit position, then shirt 1), the rest by shirt number. */
function orderSquad(list: any[]): any[] {
  const withNo = (p: any) => p.jersey_number ?? 99;
  const gkIdx = list.findIndex((p) => p.position === 'GK') !== -1 ? list.findIndex((p) => p.position === 'GK') : list.findIndex((p) => p.jersey_number === 1);
  const gk = gkIdx === -1 ? list[0] : list[gkIdx];
  return gk ? [gk, ...list.filter((p) => p !== gk).sort((a, b) => withNo(a) - withNo(b))] : [];
}

const labelOf = (p: any) => (p?.name || 'Player').split(' ')[0].slice(0, 9);

// stable references: `= []` in the signature would be a new array every render and re-trigger the squad effect forever
const NONE: any[] = [];

export function AnimatedPitch({ activeEvent, homeStarters = NONE, awayStarters = NONE, homeSubs = NONE, awaySubs = NONE }: Props) {
  const reduce = useReducedMotion();

  // starters/subs are kept locally so a replayed substitution can swap them visually
  const [squads, setSquads] = useState({ home: [] as any[], away: [] as any[], homeSubs: [] as any[], awaySubs: [] as any[] });
  const squadsRef = useRef(squads);
  useEffect(() => {
    const next = { home: orderSquad(homeStarters), away: orderSquad(awayStarters), homeSubs, awaySubs };
    squadsRef.current = next;
    setSquads(next);
  }, [homeStarters, awayStarters, homeSubs, awaySubs]);

  const [possession, setPossession] = useState<Possession>('neutral');
  const [ball, setBall] = useState<Pt>({ x: 50, y: 50 }); // where the ball is going / resting
  const [focus, setFocus] = useState<Pt>({ x: 50, y: 50 }); // what the players shape themselves around
  const [flight, setFlight] = useState<Flight>({ id: 0, height: 0, dur: 0.4 });
  const [trail, setTrail] = useState<{ id: number; from: Pt; to: Pt } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [banner, setBanner] = useState<{ id: number; text: string; tone: 'goal' | 'info' | 'warn' } | null>(null);
  const [burst, setBurst] = useState<{ id: number; pos: Pt } | null>(null);
  const [card, setCard] = useState<{ id: number; pos: Pt; color: string } | null>(null);
  const [net, setNet] = useState<{ id: number; home: boolean } | null>(null);
  const [entering, setEntering] = useState<Set<string>>(new Set());
  const [ticker, setTicker] = useState('');

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const uid = useRef(1);
  const ballRef = useRef<Pt>({ x: 50, y: 50 });
  const possessionRef = useRef<Possession>('neutral');
  const processed = useRef<PitchEvent | null>(null); // by reference, so clicking the same event again replays it

  const [homeLayout, awayLayout] = useMemo(() => separate([
    layoutTeam(squads.home.length, true, possession, focus),
    layoutTeam(squads.away.length, false, possession, focus),
  ]), [squads.home.length, squads.away.length, possession, focus]);
  const layoutRef = useRef({ home: homeLayout, away: awayLayout });
  layoutRef.current = { home: homeLayout, away: awayLayout };

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const at = useCallback((ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, reduce ? Math.min(ms, 120) : ms)); }, [reduce]);
  useEffect(() => clearTimers, []);

  const setOver = (id: string | null | undefined, o: Override | null) => {
    if (!id) return;
    setOverrides((cur) => {
      const next = { ...cur };
      if (o) next[id] = { ...cur[id], ...o }; else delete next[id];
      return next;
    });
  };

  const findPlayer = (id?: string | null) => {
    if (!id) return null;
    const s = squadsRef.current;
    for (const [side, list] of [['home', s.home], ['away', s.away]] as const) {
      const i = list.findIndex((p) => p.id === id);
      if (i !== -1) return { side, i, p: list[i] };
    }
    return null;
  };
  const posOf = (id?: string | null): Pt | null => {
    const f = findPlayer(id);
    return f ? layoutRef.current[f.side][f.i] ?? null : null;
  };

  /** Send the ball somewhere. `height` (0-1) makes it fly in an arc with a shadow on the ground. */
  const kick = useCallback((to: Pt, dur: number, height = 0) => {
    const from = ballRef.current;
    const id = uid.current++;
    ballRef.current = to;
    setTrail({ id, from, to });
    setFlight({ id, height, dur });
    setBall(to);
    at(dur * 650, () => setFocus(to));
    at(dur * 1000 + 600, () => setTrail((t) => (t && t.id === id ? null : t)));
  }, [at]);

  const teleportBall = useCallback((to: Pt) => {
    ballRef.current = to;
    setTrail(null);
    setFlight({ id: uid.current++, height: 0, dur: 0.12 });
    setBall(to);
    setFocus(to);
  }, []);

  const say = useCallback((text: string, tone: 'goal' | 'info' | 'warn' = 'info', ms = 1600) => {
    const id = uid.current++;
    setBanner({ id, text, tone });
    at(ms, () => setBanner((b) => (b && b.id === id ? null : b)));
  }, [at]);

  useEffect(() => {
    if (!activeEvent || processed.current === activeEvent) return;
    processed.current = activeEvent;
    clearTimers();
    setOverrides({});
    setCard(null);
    setBurst(null);
    setNet(null);
    setEntering(new Set());

    const ev = activeEvent;
    const type = ev.type;
    const result = ev.result || ev.metadata?.result || null;
    const actor = findPlayer(ev.actor?.id);
    const target = findPlayer(ev.target?.id);
    const side = actor?.side ?? ev.actor?.team ?? 'home';
    const isHome = side === 'home';
    const attackDir = isHome ? -1 : 1; // y direction of the opposition goal
    const goalY = goalMouth(isHome).y;
    const A = posOf(ev.actor?.id) ?? ballRef.current;
    const T = posOf(ev.target?.id);
    const ownGoalY = goalMouth(!isHome).y;

    const newPoss: Possession = actor || ev.actor?.team ? (isHome ? 'home' : 'away') : possessionRef.current;
    possessionRef.current = newPoss;
    setPossession(newPoss);
    setTicker(`${ev.minute}' ${ev.actor?.name || 'Unknown'}${ev.target?.name && ev.target.name !== 'Unknown' ? ' > ' + ev.target.name : ''}  ${type.replace(/_/g, ' ')}${result ? ' (' + String(result).replace(/_/g, ' ') + ')' : ''}`);
    const actorId = ev.actor?.id;
    const targetId = ev.target?.id;
    const lean = (id: string | null | undefined, rotate = 0, scale = 1.18) => setOver(id, { scale, rotate, glow: true, dur: 0.18 });
    const settle = (id: string | null | undefined) => setOver(id, null);

    // ---------- shots (and goals) ----------
    if (type === 'SHOT' || type === 'GOAL') {
      const outcome = type === 'GOAL' ? 'GOAL' : result || 'OFF_TARGET';
      teleportBall(A);
      lean(actorId, isHome ? -12 : 12, 1.25);
      const side6 = jitter(ev.id) > 0 ? 1 : -1;
      at(260, () => {
        settle(actorId);
        if (outcome === 'GOAL') {
          kick({ x: 50 + side6 * (4 + Math.abs(jitter(ev.id, 3)) * 3.5), y: goalY }, 0.38, 0.15);
          at(380, () => {
            setNet({ id: uid.current++, home: isHome });
            say('GOAL!', 'goal', 2600);
            setBurst({ id: uid.current++, pos: { x: 50 + side6 * 5, y: goalY } });
            // scorer runs to the corner flag, two teammates chase
            setOver(actorId, { pos: { x: side6 > 0 ? 94 : 6, y: clamp(goalY + attackDir * -8, 4, 96) }, scale: 1.3, glow: true, dur: 0.9 });
            const mates = layoutRef.current[side].map((_, i) => i).filter((i) => i !== actor?.i && i !== 0).slice(0, 2);
            mates.forEach((i, n) => setOver(squadsRef.current[side][i]?.id, { pos: { x: side6 > 0 ? 84 - n * 8 : 16 + n * 8, y: clamp(goalY + attackDir * -18, 6, 94) }, dur: 1.1 }));
          });
          at(2800, () => { setOverrides({}); teleportBall({ x: 50, y: 50 }); setPossession(isHome ? 'away' : 'home'); possessionRef.current = isHome ? 'away' : 'home'; });
        } else if (outcome === 'SAVED') {
          const gk = squadsRef.current[isHome ? 'away' : 'home'][0];
          const gx = 50 + side6 * 5;
          kick({ x: gx, y: goalY + (isHome ? 2 : -2) }, 0.36, 0.1);
          at(300, () => { setOver(gk?.id, { pos: { x: gx, y: goalY + (isHome ? 4 : -4) }, rotate: side6 * 70, scale: 1.2, glow: true, dur: 0.22 }); say('SAVED', 'info'); setBurst({ id: uid.current++, pos: { x: gx, y: goalY } }); });
          at(520, () => kick({ x: clamp(gx + side6 * 22, 5, 95), y: goalY + (isHome ? 14 : -14) }, 0.5, 0.35));
          at(1500, () => setOver(gk?.id, null));
        } else if (outcome === 'BLOCKED') {
          const stop = { x: A.x + (50 - A.x) * 0.55, y: A.y + (goalY - A.y) * 0.55 };
          kick(stop, 0.3, 0);
          at(280, () => { say('BLOCKED', 'info'); setBurst({ id: uid.current++, pos: stop }); kick({ x: clamp(stop.x + side6 * 10, 4, 96), y: clamp(stop.y - attackDir * 12, 4, 96) }, 0.45, 0.2); });
        } else if (outcome === 'WOODWORK') {
          const post = { x: 50 + side6 * 7.3, y: goalY };
          kick(post, 0.36, 0.12);
          at(360, () => { say('OFF THE POST!', 'warn'); setBurst({ id: uid.current++, pos: post }); kick({ x: post.x + side6 * 8, y: goalY - attackDir * 16 }, 0.5, 0.3); });
        } else {
          kick({ x: 50 + side6 * (13 + Math.abs(jitter(ev.id, 5)) * 6), y: goalY }, 0.42, 0.25);
          at(420, () => say('WIDE', 'info', 1100));
        }
      });
      return;
    }

    // ---------- passes, crosses, long balls ----------
    if (PASS_LIKE.has(type) || (type === 'FREE_KICK' && T)) {
      teleportBall(A);
      lean(actorId, 0, 1.15);
      const lofted = type === 'CROSS' || type === 'LONG_BALL' || type === 'DISTRIBUTION' || ['LOFTED', 'SWITCH'].includes(ev.metadata?.type);
      const dest = T ?? { x: clamp(A.x + jitter(ev.id) * 18, 8, 92), y: clamp(A.y + attackDir * 20, 6, 94) };
      at(180, () => {
        settle(actorId);
        const dist = Math.hypot(dest.x - A.x, dest.y - A.y);
        kick(dest, clamp(dist / 55 + 0.25, 0.4, 1.1), lofted ? clamp(dist / 60, 0.35, 1) : 0);
        if (type === 'THROUGH_BALL' || ev.metadata?.type === 'THROUGH_BALL') setOver(targetId, { pos: { x: dest.x, y: clamp(dest.y + attackDir * 6, 3, 97) }, dur: 0.5 });
      });
      at(150 + clamp(Math.hypot(dest.x - A.x, dest.y - A.y) / 55 + 0.25, 0.4, 1.1) * 1000, () => lean(targetId, 0, 1.15));
      at(1500, () => { settle(targetId); });
      return;
    }

    // ---------- set pieces ----------
    if (type === 'CORNER') {
      const cx = jitter(ev.id) > 0 ? 97 : 3;
      const corner = { x: cx, y: goalY };
      teleportBall(corner);
      setOver(actorId, { pos: corner, glow: true, dur: 0.6 });
      at(700, () => {
        const dest = T ?? { x: 50 + jitter(ev.id, 2) * 8, y: clamp(goalY - attackDir * -9, 4, 96) };
        kick(dest, 0.85, 0.8);
        setOver(targetId, { pos: dest, scale: 1.25, glow: true, dur: 0.5 });
      });
      at(2000, () => setOverrides({}));
      return;
    }
    if (type === 'FREE_KICK') {
      teleportBall(A);
      lean(actorId, 0, 1.2);
      at(500, () => { settle(actorId); kick({ x: 50 + jitter(ev.id) * 6, y: goalY }, 0.6, 0.4); });
      return;
    }

    // ---------- duels, fouls, tackles ----------
    if (DUEL_LIKE.has(type) && (actor || target)) {
      const B = T ?? { x: A.x + 4, y: A.y + 4 };
      const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      teleportBall(type === 'BLOCK' ? B : mid);
      setOver(actorId, { pos: { x: mid.x - 1.5, y: mid.y }, glow: true, scale: 1.1, dur: 0.3 });
      setOver(targetId, { pos: { x: mid.x + 1.5, y: mid.y }, glow: true, scale: 1.1, dur: 0.3 });
      at(320, () => {
        setBurst({ id: uid.current++, pos: mid });
        if (type === 'FOUL') {
          setOver(targetId, { rotate: 80, scale: 0.92, opacity: 0.85, dur: 0.25 });
          setOver(actorId, { pos: { x: mid.x - 4, y: mid.y - attackDir * 2 }, scale: 1, dur: 0.4 });
          say('FOUL', 'warn');
        } else if (type === 'AERIAL_DUEL' || type === 'AERIAL_CLAIM') {
          setOver(actorId, { scale: 1.45, dur: 0.2 });
          setOver(targetId, { scale: 1.45, dur: 0.2 });
          kick({ x: mid.x, y: mid.y + attackDir * -6 }, 0.6, 0.8);
        } else {
          setOver(targetId, { rotate: 55, scale: 0.95, dur: 0.25 });
          setOver(actorId, { pos: { x: mid.x, y: clamp(mid.y + attackDir * -6, 3, 97) }, scale: 1.1, dur: 0.5 });
          kick({ x: mid.x, y: clamp(mid.y + attackDir * -7, 3, 97) }, 0.45, 0);
          say(type === 'TACKLE' ? 'TACKLE' : type === 'BLOCK' ? 'BLOCK' : 'WON BALL', 'info', 1100);
        }
      });
      at(1400, () => setOverrides({}));
      return;
    }

    // ---------- carries ----------
    if (CARRY_LIKE.has(type)) {
      const loose = type === 'BALL_RECOVERY' ? { x: clamp(A.x + jitter(ev.id) * 12, 6, 94), y: clamp(A.y - attackDir * -9, 5, 95) } : null;
      teleportBall(loose ?? A);
      const end = { x: clamp(A.x + jitter(ev.id, 1) * 7, 5, 95), y: clamp((loose ?? A).y + attackDir * (type === 'DRIBBLE' ? 13 : 7), 4, 96) };
      lean(actorId, 0, 1.12);
      at(120, () => {
        setOver(actorId, { pos: end, glow: true, scale: 1.1, dur: type === 'DRIBBLE' ? 1 : 0.7 });
        if (type !== 'OFF_BALL_RUN') kick({ x: end.x, y: end.y + attackDir * 2 }, type === 'DRIBBLE' ? 1 : 0.7, 0);
      });
      if (type === 'GREAT_FIRST_TOUCH') say('FIRST TOUCH', 'info', 1100);
      at(1500, () => setOverrides({}));
      return;
    }

    // ---------- keeper and clearance actions ----------
    if (type === 'SAVE' || type === 'CLEARANCE' || type === 'SWEEPER_ACTION') {
      const gx = clamp(A.x + jitter(ev.id) * 10, 20, 80);
      teleportBall(A);
      lean(actorId, type === 'SAVE' ? 70 * (jitter(ev.id, 4) > 0 ? 1 : -1) : 0, 1.3);
      at(250, () => {
        settle(actorId);
        if (type === 'SAVE') say('SAVE', 'info');
        kick({ x: gx, y: clamp(A.y + attackDir * (type === 'SAVE' ? 18 : 34), 4, 96) }, type === 'SAVE' ? 0.6 : 0.95, type === 'SAVE' ? 0.35 : 0.9);
      });
      return;
    }

    // ---------- discipline ----------
    if (type === 'YELLOW_CARD' || type === 'RED_CARD') {
      teleportBall(A);
      lean(actorId, 0, 1.25);
      setCard({ id: uid.current++, pos: A, color: type === 'RED_CARD' ? '#e11d2e' : '#ffd400' });
      say(type === 'RED_CARD' ? 'RED CARD' : 'YELLOW CARD', 'warn', 1800);
      if (type === 'RED_CARD') at(1200, () => setOver(actorId, { opacity: 0.15, scale: 0.8, dur: 0.6 }));
      else at(1500, () => settle(actorId));
      return;
    }

    // ---------- substitution: out at the touchline, in from the touchline ----------
    if (type === 'SUBSTITUTION') {
      const s = squadsRef.current;
      const out = findPlayer(ev.actor?.id);
      const subList = out ? (out.side === 'home' ? s.homeSubs : s.awaySubs) : [];
      const incoming = subList.find((p: any) => p.id === ev.target?.id);
      if (!out || !incoming) { say('SUBSTITUTION', 'info'); return; }
      const edge = { x: 99, y: layoutRef.current[out.side][out.i]?.y ?? 50 };
      setOver(ev.actor?.id, { pos: edge, glow: true, dur: 0.8 });
      say('SUBSTITUTION', 'info', 1800);
      at(900, () => {
        const key = out.side === 'home' ? 'home' : 'away';
        const subsKey = out.side === 'home' ? 'homeSubs' : 'awaySubs';
        const cur = squadsRef.current;
        const swapped = cur[key].map((p: any) => (p.id === out.p.id ? incoming : p));
        const next = { ...cur, [key]: swapped, [subsKey]: [...cur[subsKey].filter((p: any) => p.id !== incoming.id), out.p] };
        squadsRef.current = next;
        setEntering(new Set([incoming.id]));
        setSquads(next);
        setOverrides({});
      });
      return;
    }

    // ---------- anything else: just point at who it was ----------
    teleportBall(A);
    lean(actorId, 0, 1.2);
    say(type.replace(/_/g, ' '), 'info', 1200);
    at(900, () => settle(actorId));
  }, [activeEvent, at, kick, say, teleportBall]);

  // ---------------- drawing ----------------
  const unit = (n: number) => `max(${Math.round(n * 6.6)}px, ${n}cqw)`;
  const renderTeam = (list: any[], layout: Pt[], isHome: boolean) =>
    list.map((p, i) => {
      const o = overrides[p.id];
      const pos = o?.pos ?? layout[i] ?? { x: 50, y: 50 };
      const s = toScreen(pos);
      const gk = i === 0;
      const color = gk ? (isHome ? KIT.homeGk : KIT.awayGk) : isHome ? KIT.home : KIT.away;
      const seed = (i + 1) * (isHome ? 1.3 : 1.9);
      return (
        <motion.div
          key={p.id}
          initial={entering.has(p.id) ? { left: '100%', top: `${s.top}%`, opacity: 0, scale: 0.6 } : false}
          animate={{ left: `${s.left}%`, top: `${s.top}%`, opacity: o?.opacity ?? 1, scale: o?.scale ?? 1, rotate: o?.rotate ?? 0 }}
          transition={{
            left: { type: 'spring', stiffness: o?.dur && o.dur < 0.4 ? 260 : 70, damping: 16, mass: 0.9 },
            top: { type: 'spring', stiffness: o?.dur && o.dur < 0.4 ? 260 : 70, damping: 16, mass: 0.9 },
            scale: { type: 'spring', stiffness: 320, damping: 14 },
            rotate: { type: 'spring', stiffness: 220, damping: 18 },
            opacity: { duration: 0.4 },
          }}
          style={{ position: 'absolute', x: '-50%', y: '-50%', zIndex: o ? 30 : gk ? 8 : 10, pointerEvents: 'none' }}
        >
          <div
            className="pitch-idle flex items-center justify-center rounded-full font-bold text-white"
            style={{
              width: unit(3.4), height: unit(3.4), fontSize: `max(10px, 1.45cqw)`, background: color,
              border: `${o?.glow ? 3 : 2}px solid ${o?.glow ? '#fff' : 'rgba(255,255,255,.85)'}`,
              boxShadow: o?.glow ? `0 0 14px 4px ${color}` : '0 2px 4px rgba(0,0,0,.45)',
              color: gk && isHome ? '#222' : '#fff',
              ['--dx' as any]: `${((seed % 3) - 1) * 2}px`, ['--dy' as any]: `${((seed % 2) - 0.5) * 3}px`,
              animationDelay: `${(seed * 0.37) % 3}s`, animationDuration: `${3.2 + (seed % 2)}s`,
            }}
          >
            {p.jersey_number ?? getInitials(p.name)}
          </div>
          <div className="absolute left-1/2 top-full mt-px -translate-x-1/2 whitespace-nowrap font-semibold text-white" style={{ fontSize: 'max(8px, 1.05cqw)', textShadow: '0 1px 2px #000, 0 0 3px #000' }}>
            {labelOf(p)}
          </div>
        </motion.div>
      );
    });

  const ballScreen = toScreen(ball);
  const trailFrom = trail ? toScreen(trail.from) : null;
  const trailTo = trail ? toScreen(trail.to) : null;
  const benchChip = (p: any, color: string) => (
    <span key={p.id} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1d1f1e] py-0.5 pl-0.5 pr-2 text-[10px] text-zinc-300">
      <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: color }}>{p.jersey_number ?? getInitials(p.name)}</span>
      {labelOf(p)}
    </span>
  );

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#101211] p-2">
      <style>{`
        @keyframes pitch-idle { 0%,100% { transform: translate(0,0) } 50% { transform: translate(var(--dx), var(--dy)) } }
        .pitch-idle { animation: pitch-idle 3.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .pitch-idle { animation: none; } }
        @keyframes pitch-pop { 0% { transform: translate(-50%,-50%) scale(.4); opacity: 0 } 25% { transform: translate(-50%,-50%) scale(1.15); opacity: 1 } 80% { opacity: 1 } 100% { transform: translate(-50%,-50%) scale(1); opacity: 0 } }
        @keyframes pitch-burst { 0% { transform: translate(-50%,-50%) scale(.2); opacity: .9 } 100% { transform: translate(-50%,-50%) scale(1.6); opacity: 0 } }
        @keyframes pitch-net { 0%,100% { transform: scale(1) } 30% { transform: scale(1.06,1.14) } 60% { transform: scale(.97,.94) } }
      `}</style>

      {(squads.homeSubs.length > 0 || squads.awaySubs.length > 0) && (
        <div className="flex w-full max-w-[1100px] justify-between gap-3 overflow-x-auto text-[10px] text-zinc-500">
          <div className="flex items-center gap-1.5"><span>Bench</span>{squads.homeSubs.map((p) => benchChip(p, KIT.home))}</div>
          <div className="flex items-center gap-1.5">{squads.awaySubs.map((p) => benchChip(p, KIT.away))}</div>
        </div>
      )}

      <div
        className="relative overflow-hidden rounded-md border-2 border-white/80 shadow-[0_10px_30px_rgba(0,0,0,.5)]"
        style={{ aspectRatio: '105 / 68', width: 'min(100%, calc(62vh * 105 / 68))', containerType: 'inline-size' }}
        aria-label="Animated match pitch"
      >
        {/* grass, mowing stripes and markings (105 x 68 metres) */}
        <svg viewBox="0 0 105 68" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="turf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2f8f3a" /><stop offset="1" stopColor="#287d33" /></linearGradient>
          </defs>
          <rect width="105" height="68" fill="url(#turf)" />
          {Array.from({ length: 10 }, (_, i) => <rect key={i} x={i * 10.5} width="5.25" height="68" fill="#ffffff" opacity="0.045" />)}
          <g fill="none" stroke="#fff" strokeWidth="0.35" opacity="0.9">
            <rect x="0.5" y="0.5" width="104" height="67" />
            <line x1="52.5" y1="0.5" x2="52.5" y2="67.5" />
            <circle cx="52.5" cy="34" r="9.15" />
            <rect x="0.5" y="13.85" width="16.5" height="40.3" />
            <rect x="88" y="13.85" width="16.5" height="40.3" />
            <rect x="0.5" y="24.85" width="5.5" height="18.3" />
            <rect x="99" y="24.85" width="5.5" height="18.3" />
            <path d="M17 27.3 A9.15 9.15 0 0 1 17 40.7" />
            <path d="M88 27.3 A9.15 9.15 0 0 0 88 40.7" />
            <path d="M0.5 2 A1.5 1.5 0 0 0 2 0.5" /><path d="M103 0.5 A1.5 1.5 0 0 0 104.5 2" />
            <path d="M0.5 66 A1.5 1.5 0 0 1 2 67.5" /><path d="M103 67.5 A1.5 1.5 0 0 1 104.5 66" />
          </g>
          <g fill="#fff" opacity="0.9"><circle cx="52.5" cy="34" r="0.45" /><circle cx="11" cy="34" r="0.4" /><circle cx="94" cy="34" r="0.4" /></g>
          {/* goals */}
          <rect x="-1.6" y="29.8" width="2.1" height="8.4" fill="#fff" opacity="0.22" stroke="#fff" strokeWidth="0.25" />
          <rect x="104.5" y="29.8" width="2.1" height="8.4" fill="#fff" opacity="0.22" stroke="#fff" strokeWidth="0.25" />
        </svg>

        {net && (
          <div key={net.id} className="absolute top-[43%] h-[14%] w-[2.4%] bg-white/50" style={{ [net.home ? 'right' : 'left']: 0, animation: 'pitch-net .7s ease-out', transformOrigin: net.home ? 'right center' : 'left center' }} />
        )}

        {/* ball path */}
        {trail && trailFrom && trailTo && (
          <svg key={trail.id} viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <motion.line x1={trailFrom.left} y1={trailFrom.top} x2={trailTo.left} y2={trailTo.top} stroke="#fff" strokeWidth="0.7" strokeDasharray="1.4 1.2" strokeLinecap="round" vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0, opacity: 0.9 }} animate={{ pathLength: 1, opacity: [0.9, 0.9, 0] }} transition={{ duration: Math.max(0.3, flight.dur * 1.1), times: [0, 0.5, 1] }} />
          </svg>
        )}

        {renderTeam(squads.home, homeLayout, true)}
        {renderTeam(squads.away, awayLayout, false)}

        {/* the ball: ground position (with a shadow) plus a separate height arc */}
        <motion.div
          className="pointer-events-none absolute"
          style={{ x: '-50%', y: '-50%', zIndex: 40 }}
          animate={{ left: `${ballScreen.left}%`, top: `${ballScreen.top}%` }}
          transition={{ duration: reduce ? 0 : flight.dur, ease: flight.height > 0 ? 'easeInOut' : 'easeOut' }}
        >
          <motion.div
            key={`s${flight.id}`} className="absolute left-1/2 top-1/2 rounded-full bg-black/40"
            style={{ width: unit(1.8), height: unit(0.8), x: '-50%', y: '-10%' }}
            animate={flight.height > 0 ? { scale: [1, 0.55, 1], opacity: [0.5, 0.25, 0.5] } : { scale: 1 }}
            transition={{ duration: flight.dur, ease: 'easeInOut' }}
          />
          <motion.div
            key={`b${flight.id}`}
            style={{ width: unit(1.9), height: unit(1.9), borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #fff 0 45%, #cfd3d1 70%, #8d9290 100%)', boxShadow: '0 1px 3px rgba(0,0,0,.6)', border: '1px solid #222' }}
            animate={flight.height > 0 ? { y: [0, -flight.height * 70, 0], scale: [1, 1 + flight.height * 0.9, 1], rotate: 540 } : { rotate: 240 }}
            transition={{ duration: flight.dur, ease: 'easeOut' }}
          />
        </motion.div>

        {burst && <div key={burst.id} className="pointer-events-none absolute rounded-full border-2 border-white/80" style={{ left: `${toScreen(burst.pos).left}%`, top: `${toScreen(burst.pos).top}%`, width: unit(5), height: unit(5), animation: 'pitch-burst .6s ease-out forwards', zIndex: 35 }} />}

        {card && (
          <div key={card.id} className="pointer-events-none absolute rounded-[2px] shadow-lg" style={{ left: `${toScreen(card.pos).left}%`, top: `calc(${toScreen(card.pos).top}% - ${unit(3.6)})`, width: unit(1.8), height: unit(2.6), background: card.color, animation: 'pitch-pop 1.8s ease-out forwards', zIndex: 45 }} />
        )}

        {banner && (
          <div key={banner.id} className="pointer-events-none absolute left-1/2 top-[14%] z-50 whitespace-nowrap rounded-full px-5 py-1.5 font-black uppercase tracking-widest"
            style={{
              fontSize: 'max(13px, 3cqw)', animation: 'pitch-pop 2s ease-out forwards',
              background: banner.tone === 'goal' ? 'linear-gradient(90deg,#39ff6a,#12c748)' : banner.tone === 'warn' ? '#ffb020' : 'rgba(10,12,11,.82)',
              color: banner.tone === 'info' ? '#fff' : '#06210f', boxShadow: '0 6px 20px rgba(0,0,0,.45)',
            }}>
            {banner.text}
          </div>
        )}

        {ticker && (
          <div className="pointer-events-none absolute bottom-1.5 left-1.5 z-50 max-w-[80%] truncate rounded bg-black/60 px-2 py-0.5 text-white" style={{ fontSize: 'max(9px, 1.3cqw)' }}>{ticker}</div>
        )}
      </div>
    </div>
  );
}
