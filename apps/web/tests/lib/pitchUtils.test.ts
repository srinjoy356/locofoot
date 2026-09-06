import { describe, it, expect } from 'vitest';
import { getInitials, getGeometricPositions } from '../../src/lib/pitchUtils';

describe('pitchUtils', () => {
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

  describe('getGeometricPositions', () => {
    it('returns empty for 0 players', () => {
      expect(getGeometricPositions(0, true)).toEqual([]);
    });

    it('returns only GK for 1 player', () => {
      const pos = getGeometricPositions(1, true);
      expect(pos).toEqual([{ x: '50%', y: '90%' }]);
    });

    it('calculates geometric positions for home team (5 players)', () => {
      const pos = getGeometricPositions(5, true);
      expect(pos.length).toBe(5);
      // Home team should be on bottom half, e.g. y >= 50%
      expect(parseFloat(pos[0].y)).toBeGreaterThanOrEqual(50);
    });
    
    it('calculates geometric positions for away team (11 players)', () => {
      const pos = getGeometricPositions(11, false);
      expect(pos.length).toBe(11);
      // Away team should be on top half, e.g. y <= 50%
      expect(parseFloat(pos[0].y)).toBeLessThanOrEqual(50);
    });
  });
});
