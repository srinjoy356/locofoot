# Living Pitch Animation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the pitch feel alive between events using CSS breathing animations and tactical formation shifting based on ball possession.

**Architecture:** We will apply a continuous, hardware-accelerated CSS animation to characters so they bounce on their toes. We will then update `pitchUtils.ts` to accept a `possession` parameter, shifting the entire formation up or down the pitch dynamically when possession changes. `AnimatedPitch.tsx` will track possession based on the current event.

**Tech Stack:** React, CSS, TypeScript

## Global Constraints

- No performance-heavy JS rendering loops (requestAnimationFrame). Must rely on CSS for continuous animation.
- All files exist in `apps/web/src`.

---

### Task 1: CSS Breathe Animation

**Files:**
- Modify: `apps/web/src/components/analytics/AnimatedPitch.tsx`

**Interfaces:**
- Consumes: Existing `.character` styles
- Produces: Visual idle animation

- [ ] **Step 1: Write the minimal implementation**

Add the `@keyframes` and update `.character` inside the `<style>` block in `AnimatedPitch.tsx`:

```css
        @keyframes breathe {
          0%, 100% { transform: translate(-50%, -50%) scaleY(1); }
          50% { transform: translate(-50%, -52%) scaleY(0.96); }
        }
        
        .character { 
          position: absolute; 
          transform: translate(-50%, -50%); 
          font-size: 24px; text-align: center; line-height: 1; 
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5)); 
          transition: left 0.5s ease-in-out, top 0.5s ease-in-out, opacity 0.5s; 
          z-index: 10;
          animation: breathe 1.5s infinite ease-in-out;
        }
```
*(Note: Separated `transition: left, top, opacity` from `transform` so they don't fight the CSS animation)*

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/analytics/AnimatedPitch.tsx
git commit -m "feat: add continuous breathe animation to characters"
```

### Task 2: Update pitchUtils for Possession Shift

**Files:**
- Modify: `apps/web/src/lib/pitchUtils.ts`
- Modify: `apps/web/src/lib/pitchUtils.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `getGeometricPositions(count: number, isHome: boolean, possession?: 'home' | 'away' | 'neutral'): {x: string, y: string}[]`

- [ ] **Step 1: Write the failing test**

```typescript
// in apps/web/src/lib/pitchUtils.test.ts
import { describe, it, expect } from 'vitest';
import { getGeometricPositions } from './pitchUtils';

describe('getGeometricPositions with possession', () => {
  it('shifts the home formation up when home has possession', () => {
    const neutral = getGeometricPositions(5, true, 'neutral');
    const homePossession = getGeometricPositions(5, true, 'home');
    
    // Home attacks upwards (smaller Y values)
    const neutralY = parseFloat(neutral[1].y);
    const attackingY = parseFloat(homePossession[1].y);
    expect(attackingY).toBeLessThan(neutralY);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/src/lib/pitchUtils.test.ts`
Expected: FAIL due to missing parameter support or no shift.

- [ ] **Step 3: Write minimal implementation**

Update `getGeometricPositions` in `pitchUtils.ts`:

```typescript
export function getGeometricPositions(count: number, isHome: boolean, possession: 'home' | 'away' | 'neutral' = 'neutral'): {x: string, y: string}[] {
  const positions: {x: string, y: string}[] = [];
  if (count === 0) return positions;
  
  // Base shift logic: home pushes up (-5%), away drops back (-5% so closer to 0)
  // When away has possession: away pushes down (+5%), home drops back (+5%)
  let shift = 0;
  if (possession === 'home') shift = -10;
  if (possession === 'away') shift = 10;
  
  // Place GK
  positions.push({ x: '50%', y: isHome ? `${90 + (shift*0.2)}%` : `${10 + (shift*0.2)}%` }); // GK shifts less
  
  if (count === 1) return positions;
  
  const fieldPlayers = count - 1;
  const rows = Math.ceil(Math.sqrt(fieldPlayers));
  const cols = Math.ceil(fieldPlayers / rows);
  
  let currentIdx = 0;
  for (let r = 0; r < rows; r++) {
    const rowProgress = rows > 1 ? r / (rows - 1) : 0.5;
    
    let rowY = isHome 
      ? 80 - (rowProgress * 25)
      : 20 + (rowProgress * 25);
      
    // Apply shift, ensuring they don't cross into the other half too extremely
    rowY += shift;
      
    const playersInRow = Math.min(cols, fieldPlayers - currentIdx);
    for (let c = 0; c < playersInRow; c++) {
      const colX = 10 + ((80 / (playersInRow + 1)) * (c + 1));
      positions.push({ x: `${colX}%`, y: `${rowY}%` });
      currentIdx++;
    }
  }
  return positions;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/src/lib/pitchUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pitchUtils.ts apps/web/src/lib/pitchUtils.test.ts
git commit -m "feat: apply tactical Y-axis shift based on possession state"
```

### Task 3: Track Possession in AnimatedPitch

**Files:**
- Modify: `apps/web/src/components/analytics/AnimatedPitch.tsx`

**Interfaces:**
- Consumes: `getGeometricPositions` with possession support

- [ ] **Step 1: Write the minimal implementation**

In `AnimatedPitch.tsx`:

1. Add state: `const [possession, setPossession] = useState<'home'|'away'|'neutral'>('neutral');`
2. Update the `activeEvent` watcher inside `useEffect` (around line 98):
```typescript
      // Determine possession based on the actor
      let newPossession: 'home' | 'away' | 'neutral' = 'neutral';
      if (activeEvent.actorId) {
        if (latestArrays.current.homeStarters.some(p => p.id === activeEvent.actorId) || 
            latestArrays.current.homeSubs.some(p => p.id === activeEvent.actorId)) {
          newPossession = 'home';
        } else {
          newPossession = 'away';
        }
      }
      setPossession(newPossession);
```
3. Update the calls to `getGeometricPositions` (around line 147):
```typescript
  const homePositions = getGeometricPositions(localHomeStarters.length, true, possession);
  const awayPositions = getGeometricPositions(localAwayStarters.length, false, possession);
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/analytics/AnimatedPitch.tsx
git commit -m "feat: connect possession state to timeline events and rendering"
```
