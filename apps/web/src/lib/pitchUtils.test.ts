import { describe, it, expect } from 'vitest';
import { getGeometricPositions } from './pitchUtils';

describe('getGeometricPositions with possession', () => {
  it('shifts the home formation up when home has possession', () => {
    const neutral = getGeometricPositions(5, true, 'neutral');
    const homePossession = getGeometricPositions(5, true, 'home');
    
    // Home attacks upwards (smaller Y values). We expect the first field player (index 1) to be shifted up.
    const neutralY = parseFloat(neutral[1].y);
    const attackingY = parseFloat(homePossession[1].y);
    
    expect(attackingY).toBeLessThan(neutralY);
  });
});
