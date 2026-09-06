# Living Pitch Animation System Design

## Context
Currently, the AnimatedPitch component only moves players during explicit events (passes, tackles, etc.). Between events, players remain perfectly static, which makes the pitch feel lifeless. The goal is to create a "living" match experience where players appear active and responsive, simulating real football tactics and physics without draining device battery.

## Chosen Approach
**Tactical Formation Shifting + CSS Breathe (Approach 2)**

This approach balances high realism with excellent performance by combining CSS hardware-accelerated idle animations with React-driven tactical formation shifts based on ball possession.

## Architecture & Components

### 1. Idle "Breathe" Animation (CSS)
- **Mechanism**: A continuous `@keyframes` animation applied to all player characters.
- **Visuals**: A subtle 1-2px `translateY` bounce combined with a tiny `scaleY` (e.g., `0.98` to `1.0`) running on a 1.5s infinite loop. This simulates players bouncing on their toes, ready for action.
- **Performance**: Handled entirely by the browser's compositor thread (GPU accelerated). Zero impact on React's render cycle or main thread CPU.

### 2. Tactical Formation Shifting (React / Logic)
- **Mechanism**: Track the current "possession" state (`'home' | 'away' | 'neutral'`) within `AnimatedPitch`.
- **Logic**:
  - When an event fires, we check the `actorId`. If the actor belongs to the Home team, possession becomes `'home'`.
  - The `getGeometricPositions` function will be updated to accept the `possession` state.
  - If Home has possession, the entire Home formation pushes up the pitch (e.g., Y-coordinates decrease by 5-10%), and Away drops back into a defensive block (Y-coordinates decrease by 5-10%).
  - Because `AnimatedPitch` already uses CSS `transition: all 0.5s ease-in-out` on player positions, changing the baseline formation coordinates will cause players to smoothly jog up and down the pitch as possession changes.

## Data Flow
1. **Event Trigger**: A new event is passed to `AnimatedPitch` (e.g., via the timeline auto-play or live subscription).
2. **Determine Possession**: The event parser identifies the team of the `actorId`. State `possession` is updated.
3. **Calculate Positions**: `getGeometricPositions` receives the new `possession`. It shifts the row anchors.
4. **Render & Transition**: React renders the new `top`/`left` styles. The browser interpolates the movement, causing the teams to dynamically press and retreat.

## Error Handling & Edge Cases
- **Unknown Events**: If an event doesn't clearly indicate possession (e.g., a yellow card), possession defaults to `'neutral'` or remains unchanged.
- **Goalkeepers**: Goalkeepers should be excluded from the tactical shift (or shifted much less) so they don't wander out of their penalty box.

## Testing Strategy
- **Performance**: Verify on a mobile device/emulator that the continuous CSS breathe animation does not cause frame drops.
- **Visual**: Ensure that when possession changes, the two teams do not accidentally overlap in the midfield.

## Open Questions / Clarifications
- None at this time. The scope is strictly contained to `AnimatedPitch` and `pitchUtils`.
