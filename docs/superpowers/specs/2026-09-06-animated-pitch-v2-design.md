# Animated Pitch V2 Design Spec

## 1. Overview
The goal is to render a fully dynamic, real-data-driven animated pitch for live football matches. Instead of a generic choreography with placeholder players, the pitch will fetch the exact starting lineups and substitute benches for both teams, rendering all participating players on the field using their real initials.

## 2. Architecture & Data Flow
- **Data Fetching (`PublicMatchPage`)**: 
  - Extend the existing data fetching logic to query `match_lineups` and `match_lineup_players` for both the home and away teams to determine who is currently on the field (Starters). 
  - The remaining players from `event_team_players` will be designated as substitutes.
  - The `players_on_field` value from `event_settings` will dictate the scale.
  
- **Component Interface (`AnimatedPitch`)**:
  - `activeEvent`: The current event triggering an animation.
  - `homeStarters`: Array of player objects (id, name, initials).
  - `awayStarters`: Array of player objects.
  - `homeSubs` & `awaySubs`: Array of players on the bench.
  - `homeTeamName` & `awayTeamName`.

## 3. Player Rendering & Layout
- **Initials Extraction**: A utility will parse real `display_name`s to generate a 2-character string (e.g. `Ramendu Ghosh` -> `RG`).
- **Geometric Distribution**: Players will be distributed geometrically to avoid relying on a mandatory `position` field.
  - `Home Team`: Placed in a structured grid/arc on the bottom half of the field.
  - `Away Team`: Placed symmetrically on the top half of the field.
  - The layout will dynamically scale out based on the total number of starters.
- **Benches**: Substitutes will be rendered horizontally outside the pitch boundaries.

## 4. Animation Choreography
- **Involved Players**: The `actor` and `target` in the `activeEvent` will break formation to execute the exact HTML/CSS choreography (passes, tackles, goals, cards).
- **Uninvolved Players**: The rest of the players will hold their grid positions, but will slightly "track" the ball by shifting subtly towards the ball's coordinates.
- **Substitutions**: When a substitution event occurs, the specific `actor` (player coming off) will walk off the pitch, and the `target` (player coming on) will leave the bench and walk to their spot on the pitch. State will be updated to swap them in the starter/sub arrays.

## 5. Error Handling & Edge Cases
- **Missing Lineups**: If a team hasn't submitted a lineup, the pitch will fallback to showing just the actor/target for events without the full 22-player grid.
- **Missing Display Names**: Fallback to "P1", "P2" for missing names.
- **Invalid Events**: If an event has missing targets (e.g. a pass with no target), the ball will simply move forward generically.
