# Decisions

## 2026-10-13 Tournament formats
- `POST /events/{id}/fixtures/generate` builds every supported format in one call: `ROUND_ROBIN`, `DOUBLE_ROUND_ROBIN`,
  `KNOCKOUT`, `GROUP_KNOCKOUT` (options: `group_count`, `advance_per_group`, `third_place`, `double_round_robin_groups`).
  `SWISS` and `CUSTOM` stay manual. Pure maths lives in `services/tournament_format.py` (unit tested), orchestration in
  `services/tournament_service.py`.
- Knockout slots are `brackets` rows whose sources are resolved lazily (`group_position`, `winner_of`, `loser_of`).
  `advance_bracket` runs after every match completion and only fills EMPTY team slots, so a started match is never rewritten.
  Shortcut: results corrected after a downstream match was filled do not re-open that match.
- Group tables and tie-breaks (points, goal difference, goals for, head-to-head points, then id) are recomputed from
  completed matches on demand; nothing is cached (rule 13). The `tie_break_order` setting is not read yet.
- Drawn knockout matches need a manual winner (`POST /events/{id}/matches/{match}/winner`, stored as `winner_registration_id`,
  `result_type = PENALTIES`). There is no shoot-out recording yet.
- The live scheduler places a knockout game only after the games that decide its teams sit in an earlier slot.

## 2026-10-13 Live recording
- `record_*_event` used to swallow every database error and answer "success". Now only a unique violation (a retry of the
  same client UUID) is treated as success; everything else is a 400/500 the recorder can see.
- Recorder "undo" deletes the timeline row after snapshotting it into `audit_logs` (`UNDO_TIMELINE_EVENT`). The previous soft
  `deleted: true` flag was ignored by every stats view, so undone events kept counting. Rows soft-deleted before this change
  still exist in old data and still count.
- Officiating routes require event staff, a REFEREE/SCORER role, or an assignment on that match; lineup routes require staff
  or the team's own captain. Scheduling mutations require EVENT_OWNER/EVENT_ADMIN.

## 2026-10-13 Database
- The migration history could not rebuild the schema (columns/tables created by hand on the hosted project). `00371_repair_*`
  restores them idempotently; 0047 had a wrong `auth.users` join. Rebuild from scratch is verified on a local Supabase.
- `users` was updatable column-by-column by any signed-in user (including `platform_role`). Updates are now limited to profile
  columns (0072). `match_player_ratings` had RLS disabled (0072).
- Realtime publication now includes matches/events/schedule tables (0073). Realtime must be restarted after changing it.

## 2026-10-13 Predictions (virtual coins)
- A free prediction game on live matches. Coins have no cash value and never leave the app; sign-in is required to place anything,
  odds and the leaderboard are public. New players get 1000 coins; a broke player (under 100, nothing pending) can claim 300 once a day.
- Money safety lives in the database (`0077`): `bet_place` and `bet_apply_result` are SECURITY DEFINER, service-role only, and every
  coin movement is a `bet_ledger` row, so `wallet.balance = sum(ledger)` is checkable. Browsers can read their own rows, never write.
- Odds come from a Poisson model (`betting_odds.py`) shrunk towards the league average, re-priced from score and clock on every request;
  a bet locks the price it was placed at and is refused with ODDS_CHANGED if the live price got worse. Margin 8%.
- Settlement is recomputed from the timeline after every goal, undo, correction and state change, so undoing a goal reverses payouts.
- Integrity rules: staff and players of a match cannot bet on it; betting freezes 8 s after any shot and while officials pause it;
  quick matches have no predictions (the creator controls the result).

## 2026-10-13 Recording at speed
- `POST .../timeline/events` takes up to 100 events in one request; the recorder queue sends whatever is waiting as one batch. A rejected
  batch is retried event by event so one bad event cannot block the rest.
- Quick scorer: team focus (one phone per team), back-dating and flagged moments, keyboard mode, haptic tap feedback, and a saved shot also
  logs the keeper save. Shot location is optional (off by default).

## 2026-10-13 After-match data
- Assists on the goal event now count (`0074`); team and player shots on target and aerials use the same rules.
- League standings list every team, exclude knockout games and break ties head-to-head (`/statistics/standings`).
- Team stats are recomputed from matches (the old view ignored the points settings and always reported 0 clean sheets and cards).

## 2026-10-20 Full tournament run (8 teams, 2 groups, knockouts) through the UI
- Roles: the recorder (SCORER) may log play (`timeline/*`) but not run the match. `referee/state|forfeit|event` now use a stricter guard
  (`require_match_referee`: staff, REFEREE, or assigned referee). Before this a scorer could kick off, forfeit or card via the API even
  though the referee console refused them. The recorder page now shows "Access denied" to anyone who is not an official.
- Kick-off needs both lineups confirmed and the state machine (`ALLOWED_TRANSITIONS`) is enforced server-side; a referee may confirm
  lineups for the match they run.
- Tournament squads may contain guest players (no account): the old rule meant an 8-a-side team could only register people who had signed up.
- Draw mode: `SEEDED` (default) deals groups in snake order from `seed`; `RANDOM` shuffles. A team cannot be placed in two games of one slot.
- A drawn knockout is completed as a draw and decided by the organizer with the shoot-out score (stored in `matches.metadata.shootout`);
  the bracket then advances. The grid and the match page now show the shoot-out.
- Cards and fouls in the referee audit log carry the player's name (`metadata.player_name`); a second yellow produces a RED_CARD row
  ("second yellow card") that is counted once in discipline stats.
- Fixed policies/RLS: DRAFT events visible to their owner (0078), `is_user_visible` joined a missing column and hid officials and
  team mates from the recorder (0079), referee invitations check role and overlapping matches (0080), referee notification type (0081).
- Known gap, not changed: "SUSPENDED" on the disciplinary page is a label only (red card or 3 yellows). Nothing stops a suspended player
  being named in a lineup; the number of matches banned is not defined yet.
