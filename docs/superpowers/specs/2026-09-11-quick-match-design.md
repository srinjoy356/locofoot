# Quick Match (Pickup Game) Design Spec

## Overview
The "Quick Match" feature allows users to instantly start a match from the sidebar without navigating through the extensive tournament and team registration flows. It is designed to support both registered LocoFoot users and unregistered "ghost" players seamlessly, while fully integrating with the existing Match Control Room, statistics, and referee engines.

## Architectural Approach

### 1. Event Type Segregation
A Quick Match will inherently be a 1-match `Event` in the database to ensure compatibility with all existing statistics and live-match systems.
- **Database Change:** Add `event_type` ENUM to the `events` table with values `('TOURNAMENT', 'QUICK_MATCH')`. Default is `TOURNAMENT`.
- **Visibility:** The Explore page, public Events lists, and standard Organizer dashboards will filter out `QUICK_MATCH` events. They will only appear in a user's match history and the Quick Match management screens.

### 2. Team & Player Registration (Ghost Players)
To allow organizers to record stats for friends who don't have LocoFoot accounts, we will introduce "Ghost Players".
- **Database Change:** Alter `event_team_players` to make `user_id` `NULLABLE` and add a new `guest_name` text column.
- **Mechanic:** A player on a Quick Match roster will either have a `user_id` (if they are a registered LocoFoot user) OR a `guest_name` (if they are a ghost player).
- **Stats Integration:** Since the entire match statistics engine (goals, cards, timeline) is linked to `event_team_players.id`, ghost players will automatically accrue statistics perfectly within the scope of that single match.

### 3. Streamlined Setup UI
A single, highly optimized React page/modal will replace the multi-step tournament flow.

**UI Sections:**
1. **Match Details:** Match Name/Location (optional), Date/Time (defaults to now).
2. **Roles:** Inputs to assign a Referee and a Recorder (Scorer) by searching registered users. These users will be granted `REFEREE` and `SCORER` roles in `event_roles` for the auto-generated background event.
3. **Team A & Team B Rosters:** 
   - Fields to name Team A and Team B (defaults to "Team A" and "Team B").
   - A unified "Add Player" input for each team.
   - If the organizer selects an existing LocoFoot user from the search dropdown, their `user_id` is assigned.
   - If the organizer just types a name and presses Enter, a Ghost Player (`guest_name`) is created.

### 4. Background Execution Flow
When the organizer clicks **"Start Quick Match"**, the API will sequentially:
1. Create an `Event` with `event_type = 'QUICK_MATCH'`, `status = 'LIVE'`, and `tournament_format = 'CUSTOM'`.
2. Create `event_roles` for the assigned Referee and Recorder.
3. Create two `teams` (Team A, Team B).
4. Create two `event_team_registrations` with `status = 'APPROVED'`.
5. Bulk insert the players into `event_team_players` (handling both `user_id` and `guest_name` variants) with `status = 'APPROVED'`.
6. Create a single `match` with `status = 'SCHEDULED'` (or 'LIVE' if starting instantly).
7. Redirect the organizer/referee directly to the Match Control Room for this match.

## Open Questions & Ambiguities (Self-Review)
- *Are Quick Matches public or private by default?* They will be treated identically to events regarding public visibility. Because they are not 'DRAFT', their live match URL can be shared, but they won't clutter the main Explore feed due to the `event_type` filter.
- *Who can edit the rosters later?* Since it's a Quick Match, the Organizer retains full permissions. Once the match starts, standard roster locking rules apply unless overridden.
- *Can Ghost Players be claimed later?* Not in this initial version (YAGNI). If requested later, we can build a "claim profile" feature to migrate a `guest_name` record to a real `user_id`.
