export function getInitials(name: string | null | undefined): string {
  if (!name || name.trim() === '') return 'P';
  // Replace underscores and dashes with spaces to handle mock names like test_team_6_688464
  const normalized = name.replace(/_|-/g, ' ');
  const parts = normalized.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Pitch geometry. All logic works in one frame: x runs across the pitch (0-100), y along it (0-100),
 * the home team defends y=100 and attacks y=0 (same frame the recorder stores shot coordinates in).
 * `toScreen` turns that into the landscape view used for drawing, home attacking to the right.
 */
export type Pt = { x: number; y: number };
export type Possession = 'home' | 'away' | 'neutral';

export const toScreen = (p: Pt) => ({ left: 100 - p.y, top: p.x });
export const goalMouth = (attackingHome: boolean): Pt => ({ x: 50, y: attackingHome ? 0 : 100 });
export const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** Small deterministic number in [-1, 1) from a string, so a replayed event always looks the same. */
export function jitter(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 2000) / 1000 - 1;
}

const FORMATIONS: Record<number, number[]> = {
  1: [1], 2: [1, 1], 3: [1, 2], 4: [2, 2], 5: [2, 2, 1], 6: [2, 3, 1],
  7: [3, 3, 1], 8: [3, 3, 2], 9: [3, 4, 2], 10: [4, 4, 2],
};

/** Defenders / midfielders / forwards for a given number of outfield players. */
export function formationRows(fieldPlayers: number): number[] {
  if (fieldPlayers <= 0) return [];
  if (FORMATIONS[fieldPlayers]) return FORMATIONS[fieldPlayers];
  const fwd = Math.max(1, Math.round(fieldPlayers * 0.2));
  const def = Math.round((fieldPlayers - fwd) * 0.45);
  return [def, fieldPlayers - fwd - def, fwd];
}

// distance of each line from the team's own goal line, as a share of pitch length
const DEPTH = { gk: 5, rows: [20, 34, 46] };

/**
 * Where each player of one team stands. Index 0 is the goalkeeper, then defenders, midfielders, forwards.
 * `possession` pushes the whole block up or back; the nearest players are drawn towards the ball.
 */
export function layoutTeam(count: number, isHome: boolean, possession: Possession = 'neutral', ball?: Pt): Pt[] {
  if (count === 0) return [];
  const push = possession === 'neutral' ? 0 : possession === (isHome ? 'home' : 'away') ? 9 : -6;
  const toY = (depth: number) => clamp(isHome ? 100 - depth - push : depth + push, 2, 98);

  const pts: Pt[] = [{ x: 50, y: toY(DEPTH.gk + push * 0.15) }];
  const rows = formationRows(count - 1);
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) pts.push({ x: 12 + ((76 / (n + 1)) * (i + 1)), y: toY(DEPTH.rows[Math.min(r, 2)]) });
  });

  if (!ball) return pts;
  return pts.map((p, i) => {
    if (i === 0) return { x: p.x, y: clamp(p.y + (ball.y - p.y) * 0.04, 2, 98) };
    const d = Math.hypot(p.x - ball.x, p.y - ball.y);
    const k = 0.32 * Math.exp(-d / 24); // the closer a player is, the more he steps to the ball
    return { x: clamp(p.x + (ball.x - p.x) * k, 3, 97), y: clamp(p.y + (ball.y - p.y) * k, 3, 97) };
  });
}

/** Nearest outfield player of a team to a point, so a free ball always has a carrier. */
export function nearestIndex(points: Pt[], to: Pt): number {
  let best = -1, bestD = Infinity;
  points.forEach((p, i) => {
    if (i === 0 && points.length > 1) return;
    const d = Math.hypot(p.x - to.x, p.y - to.y);
    if (d < bestD) { best = i; bestD = d; }
  });
  return best;
}

const M_X = 0.68; // metres per percent across the pitch (68 m)
const M_Y = 1.05; // metres per percent along the pitch (105 m)

/**
 * Nudge players apart so shirts and labels never sit on top of each other: any two closer than `minMetres`
 * are pushed away from one another along the line joining them. Goalkeepers stay put.
 */
export function separate(teams: Pt[][], minMetres = 3.6, passes = 4): Pt[][] {
  const out = teams.map((t) => t.map((p) => ({ ...p })));
  const all = out.flatMap((t, ti) => t.map((p, i) => ({ p, fixed: i === 0 && t.length > 1, ti })));
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        let dx = (b.p.x - a.p.x) * M_X, dy = (b.p.y - a.p.y) * M_Y;
        let d = Math.hypot(dx, dy);
        if (d >= minMetres) continue;
        if (d < 0.01) { dx = (i % 2 ? 1 : -1) * 0.5; dy = 0.5; d = Math.hypot(dx, dy); }
        const push = (minMetres - d) / 2;
        const ux = dx / d, uy = dy / d;
        const wa = a.fixed ? 0 : b.fixed ? 2 : 1, wb = b.fixed ? 0 : a.fixed ? 2 : 1;
        a.p.x = clamp(a.p.x - (ux * push * wa) / M_X, 2, 98);
        a.p.y = clamp(a.p.y - (uy * push * wa) / M_Y, 2, 98);
        b.p.x = clamp(b.p.x + (ux * push * wb) / M_X, 2, 98);
        b.p.y = clamp(b.p.y + (uy * push * wb) / M_Y, 2, 98);
      }
    }
  }
  return out;
}
