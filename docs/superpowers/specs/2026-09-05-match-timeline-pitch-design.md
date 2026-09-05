# Match Timeline Animated Pitch Design

## Purpose
To create a highly engaging, interactive 2D football pitch visualization that sits above the match timeline on the Match Stats page. As the user explores the timeline, the pitch visually choreographs the events (passes, goals, cards, subs) using player avatars on a responsive field.

## Architecture & Components

1. **`AnimatedPitch` Component**
   - Renders a CSS/SVG-based football field.
   - Vertically oriented for mobile responsiveness (Attacking direction is up/down).
   - Manages state for player positions, ball position, and active visual effects.

2. **`TimelineEvent` Mapper**
   - Translates Supabase `match_timeline_events` and `referee_events` into animation instructions (Actor, Target, Action).
   - Supports fallback positioning (e.g., if we don't have exact coordinates, defenders are placed in the defensive third, attackers in the attacking third).

3. **`MatchTimeline` Orchestrator**
   - The parent component that holds both the `AnimatedPitch` and the scrollable list of events.
   - Uses `IntersectionObserver` or a click-handler to determine the "active" event.
   - When an event becomes active, it triggers the animation *once* (as requested).

## Layout & Rendering

- **The Field:** A vertical green pitch with CSS-drawn boundary lines, penalty areas, and center circle.
- **The Benches:** Two distinct sections *outside* the pitch boundary for home and away substitutes. 
- **The Avatars:** Players are represented as 2D icons (e.g. 🧍‍♂️ or jersey icons) colored by their team, with small name/number labels below them.
- **Mobile First:** The pitch takes up the top section of the screen, and the timeline list scrolls beneath it.

## Event Animations (The Choreography)

- **Goal:** Ball flies from Actor to Goal. A "GOAL!" explosion effect triggers.
- **Pass / Key Pass / Assist / Cross:** Ball translates across the field from Actor to Target. A dashed line briefly traces the path.
- **Save:** Ball moves toward goal, Goalkeeper avatar dives/translates into the path to block it.
- **Nutmeg:** Attacker moves forward, ball passes *through* the defender's position. Defender performs a CSS shake.
- **Foul / Tackle:** Actor rushes into the Target player. A collision emoji (💥) appears.
- **Cards (Yellow/Red):** A card icon pops up above the offending player. If Red Card, the player fades to 0 opacity and leaves the pitch.
- **Substitution:** The outgoing player walks off the pitch to the bench. The incoming substitute walks from the bench onto the pitch.

## Constraints & Considerations

- **Event Idempotency:** Animations must play exactly once when triggered to avoid chaotic jumping if the user scrolls quickly.
- **Coordinate System:** Since we do not have XY tracking data for every movement in the database, the component will use semantic positioning (e.g., GK is always near the goal, FWD is near the opposition box) and animate relative to those anchor points.
- **Performance:** Animations will rely strictly on CSS transitions (`transform: translate`) rather than heavy JS requestAnimationFrame loops, ensuring smooth 60fps on mobile devices.
