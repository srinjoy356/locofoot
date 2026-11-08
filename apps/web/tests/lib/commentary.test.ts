import { describe, it, expect } from 'vitest';
import { commentary, isKeyEvent } from '../../src/lib/commentary';

describe('commentary', () => {
  it('describes shots by outcome', () => {
    expect(commentary('SHOT', 'Ada', null, 'GOAL')).toBe('GOAL! Ada scores');
    expect(commentary('SHOT', 'Ada', null, 'SAVED')).toBe('Ada forces a save');
    expect(commentary('SHOT', 'Ada', null, 'WOODWORK')).toBe('Ada hits the woodwork!');
    expect(commentary('SHOT', 'Ada')).toBe('Ada takes a shot');
  });

  it('uses both players where there are two', () => {
    expect(commentary('PASS', 'Bo', 'Cy')).toBe('Bo finds Cy');
    expect(commentary('TACKLE', 'Bo', 'Cy')).toBe('Bo wins the ball from Cy');
    expect(commentary('SUBSTITUTION', 'Out', 'In')).toBe('In replaces Out');
  });

  it('survives missing names and unknown types', () => {
    expect(commentary('PASS')).toBe('A player finds a team-mate');
    expect(commentary('OFF_BALL_RUN', 'Dee')).toBe('off ball run by Dee');
  });

  it('keeps passes out of the key moments filter', () => {
    expect(isKeyEvent('SHOT')).toBe(true);
    expect(isKeyEvent('YELLOW_CARD')).toBe(true);
    expect(isKeyEvent('PASS')).toBe(false);
  });
});
