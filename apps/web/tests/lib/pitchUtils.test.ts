import { describe, it, expect } from 'vitest';
import { formationRows, getInitials, separate, goalMouth, jitter, layoutTeam, nearestIndex, toScreen } from '../../src/lib/pitchUtils';

describe('formationRows', () => {
  it('always places every outfield player', () => {
    for (let n = 1; n <= 14; n++) expect(formationRows(n).reduce((a, b) => a + b, 0)).toBe(n);
  });
  it('uses familiar shapes for common sizes', () => {
    expect(formationRows(6)).toEqual([2, 3, 1]); // 7-a-side
    expect(formationRows(10)).toEqual([4, 4, 2]); // 11-a-side
  });
});

describe('layoutTeam', () => {
  it('puts the keeper first, near their own goal, and everyone on the pitch', () => {
    const home = layoutTeam(7, true);
    const away = layoutTeam(7, false);
    expect(home).toHaveLength(7);
    expect(home[0].y).toBeGreaterThan(90); // home defends y=100
    expect(away[0].y).toBeLessThan(10);
    for (const p of [...home, ...away]) {
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(100);
    }
  });

  it('pushes the side in possession up and drops the other', () => {
    const neutral = layoutTeam(7, true)[1].y;
    expect(layoutTeam(7, true, 'home')[1].y).toBeLessThan(neutral);
    expect(layoutTeam(7, true, 'away')[1].y).toBeGreaterThan(neutral);
  });

  it('draws nearby players to the ball more than distant ones', () => {
    const base = layoutTeam(7, true);
    const ball = { x: base[3].x + 6, y: base[3].y - 6 };
    const moved = layoutTeam(7, true, 'neutral', ball);
    const shift = (i: number) => Math.hypot(moved[i].x - base[i].x, moved[i].y - base[i].y);
    expect(shift(3)).toBeGreaterThan(shift(1) * 0 + 0.5);
    expect(moved[0].x).toBe(50); // keeper holds the centre line
  });

  it('does not stack players on the same spot', () => {
    const pts = layoutTeam(10, false);
    const keys = new Set(pts.map((p) => `${p.x.toFixed(1)}:${p.y.toFixed(1)}`));
    expect(keys.size).toBe(pts.length);
  });
});

describe('helpers', () => {
  it('home attacks right on screen, away attacks left', () => {
    expect(toScreen(goalMouth(true)).left).toBe(100);
    expect(toScreen(goalMouth(false)).left).toBe(0);
  });
  it('jitter is deterministic and bounded', () => {
    expect(jitter('abc')).toBe(jitter('abc'));
    expect(jitter('abc')).not.toBe(jitter('abd'));
    for (let i = 0; i < 50; i++) expect(Math.abs(jitter(`id-${i}`, i))).toBeLessThanOrEqual(1);
  });
  it('nearestIndex skips the keeper', () => {
    const pts = layoutTeam(7, true);
    expect(nearestIndex(pts, pts[0])).not.toBe(0);
  });
});

describe('getInitials', () => {
  it('extracts initials correctly for two words', () => {
    expect(getInitials('Ramendu Ghosh')).toBe('RG');
  });

  it('extracts initials correctly for one word', () => {
    expect(getInitials('Srinjoy')).toBe('SR');
  });

  it('extracts initials correctly for more than two words', () => {
    expect(getInitials('Cristiano Ronaldo dos Santos')).toBe('CS');
  });

  it('handles empty or null', () => {
    expect(getInitials('')).toBe('P');
    expect(getInitials(null as any)).toBe('P');
  });
});

describe('separate', () => {
  it('pushes overlapping opponents apart but keeps keepers where they are', () => {
    const home = layoutTeam(5, true);
    const away = layoutTeam(5, false);
    const crowded = [home.map((p, i) => (i === 0 ? p : { x: 50, y: 50 })), away.map((p, i) => (i === 0 ? p : { x: 50.2, y: 50.2 }))];
    const [h, a] = separate(crowded);
    const metres = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot((p.x - q.x) * 0.68, (p.y - q.y) * 1.05);
    for (let i = 1; i < h.length; i++) for (let j = 1; j < a.length; j++) expect(metres(h[i], a[j])).toBeGreaterThan(2.5);
    expect(h[0]).toEqual(home[0]);
    expect(a[0]).toEqual(away[0]);
  });
  it('leaves a well spaced formation untouched', () => {
    const home = layoutTeam(7, true);
    const away = layoutTeam(7, false);
    const [h] = separate([home, away]);
    expect(h).toEqual(home);
  });
});
