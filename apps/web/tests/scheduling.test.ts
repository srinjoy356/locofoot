import { describe, it, expect } from 'vitest';
import { 
  generateLeagueFixtures, 
  calculateSlotDuration, 
  generateSlotSequence, 
  validateAIJSONResponse, 
  isValidNoBackToBack 
} from '../src/lib/scheduling';

describe('Scheduling Utilities', () => {
  describe('Fixture Generation (League)', () => {
    it('generates 6 fixtures for a 4-team league', () => {
      const teams = ['A', 'B', 'C', 'D'];
      const fixtures = generateLeagueFixtures(teams);
      expect(fixtures.length).toBe(6);
      
      // No self-pairing
      fixtures.forEach(([home, away]) => {
        expect(home).not.toBe(away);
      });
      
      // No duplicate pairs
      const uniquePairs = new Set(fixtures.map(([home, away]) => [home, away].sort().join('-')));
      expect(uniquePairs.size).toBe(6);
    });

    it('generates 15 fixtures for a 6-team league', () => {
      const teams = ['A', 'B', 'C', 'D', 'E', 'F'];
      const fixtures = generateLeagueFixtures(teams);
      expect(fixtures.length).toBe(15);
      
      const uniquePairs = new Set(fixtures.map(([home, away]) => [home, away].sort().join('-')));
      expect(uniquePairs.size).toBe(15);
    });

    it('generates 28 fixtures for an 8-team league', () => {
      const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const fixtures = generateLeagueFixtures(teams);
      expect(fixtures.length).toBe(28);
    });
  });

  describe('Slot Generation & Math', () => {
    it('calculates 12+1+12 match duration to 25 minutes', () => {
      const duration = calculateSlotDuration({ halves: 2, half_duration: 12, half_time: 1 });
      expect(duration).toBe(25);
    });

    it('generates slots properly with exact fit', () => {
      // 3:00 PM to 3:52 PM (52 mins total space)
      // Duration 25 + buffer 1 = 26 mins per block.
      // 2 slots fit exactly: (0-25), buffer 1, (26-51) -> ends at 51.
      const start = new Date('2024-01-01T15:00:00Z');
      const end = new Date('2024-01-01T15:51:00Z'); // Exact fit for 2 slots
      
      const slots = generateSlotSequence(start, end, 25, 1, 1);
      expect(slots.length).toBe(2);
      expect(slots[0].sequence).toBe(1);
      expect(slots[1].sequence).toBe(2);
    });

    it('truncates slots if window is one minute too short', () => {
      const start = new Date('2024-01-01T15:00:00Z');
      const end = new Date('2024-01-01T15:50:00Z'); // 1 minute too short for 2 slots
      
      const slots = generateSlotSequence(start, end, 25, 1, 1);
      expect(slots.length).toBe(1);
    });
  });

  describe('Algorithm Logic', () => {
    it('filters back-to-back pairings properly', () => {
      const preceding = new Set(['A', 'B']);
      
      expect(isValidNoBackToBack(new Set(['C', 'D']), preceding)).toBe(true);
      expect(isValidNoBackToBack(new Set(['A', 'C']), preceding)).toBe(false);
      expect(isValidNoBackToBack(new Set(['B', 'D']), preceding)).toBe(false);
    });
  });

  describe('AI JSON Validation', () => {
    it('validates deterministic AI slot output correctly', () => {
      const validJSON = JSON.stringify({
        timezone: 'UTC',
        slots: [
          { sequence: 1, start: '2024-01-01T15:00:00Z', end: '2024-01-01T15:25:00Z' },
          { sequence: 2, start: '2024-01-01T15:26:00Z', end: '2024-01-01T15:51:00Z' }
        ]
      });
      const result = validateAIJSONResponse(validJSON);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('rejects duplicate sequences', () => {
      const invalidJSON = JSON.stringify({
        timezone: 'UTC',
        slots: [
          { sequence: 1, start: '2024-01-01T15:00:00Z', end: '2024-01-01T15:25:00Z' },
          { sequence: 1, start: '2024-01-01T15:26:00Z', end: '2024-01-01T15:51:00Z' }
        ]
      });
      const result = validateAIJSONResponse(invalidJSON);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Slot 1: duplicate sequence 1');
    });

    it('rejects overlapping slots', () => {
      const invalidJSON = JSON.stringify({
        timezone: 'UTC',
        slots: [
          { sequence: 1, start: '2024-01-01T15:00:00Z', end: '2024-01-01T15:30:00Z' },
          { sequence: 2, start: '2024-01-01T15:26:00Z', end: '2024-01-01T15:51:00Z' } // Starts before previous ends
        ]
      });
      const result = validateAIJSONResponse(invalidJSON);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Slot 1: overlaps with previous slot');
    });
  });
});
