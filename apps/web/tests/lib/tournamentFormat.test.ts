import { describe, it, expect } from 'vitest';
import { DEFAULT_FORMAT_CONFIG as cfg, groupSizes, knockoutMatches, planFixtures } from '../../src/lib/tournamentFormat';

describe('planFixtures', () => {
  it('counts leagues', () => {
    expect(planFixtures('ROUND_ROBIN', 6, cfg).total).toBe(15);
    expect(planFixtures('DOUBLE_ROUND_ROBIN', 4, cfg).total).toBe(12);
  });

  it('counts knockouts with and without third place', () => {
    expect(knockoutMatches(8, false)).toBe(7);
    expect(knockoutMatches(8, true)).toBe(8);
    expect(knockoutMatches(3, true)).toBe(2); // no semi-finals, so no third-place game
    expect(knockoutMatches(5, true)).toBe(5); // 4 + third place
  });

  it('plans groups + knockout (matches the backend: 8 teams -> 12 + 4)', () => {
    const p = planFixtures('GROUP_KNOCKOUT', 8, cfg);
    expect(p).toMatchObject({ valid: true, groupMatches: 12, knockoutMatches: 4, total: 16 });
  });

  it('handles uneven groups', () => {
    expect(groupSizes(7, 2)).toEqual([4, 3]);
    expect(planFixtures('GROUP_KNOCKOUT', 7, cfg).groupMatches).toBe(6 + 3);
  });

  it('rejects impossible setups', () => {
    expect(planFixtures('GROUP_KNOCKOUT', 3, cfg).valid).toBe(false);
    expect(planFixtures('GROUP_KNOCKOUT', 8, { ...cfg, advancePerGroup: 5 }).valid).toBe(false);
    expect(planFixtures('ROUND_ROBIN', 1, cfg).valid).toBe(false);
  });
});
