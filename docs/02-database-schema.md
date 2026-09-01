# 02 — Database Schema (Supabase / Postgres)

Conventions used throughout:

- Every table has `id uuid primary key default gen_random_uuid()` unless noted.
- Every table has `created_at timestamptz not null default now()`; mutable tables also get
  `updated_at timestamptz not null default now()` maintained by a shared `set_updated_at()` trigger.
- Foreign keys are `on delete restrict` by default (never silently cascade-delete tournament
  history); explicit exceptions are noted.
- Money/points are `numeric`, not `float`.
- One migration file per numbered group below, e.g. `supabase/migrations/0003_teams.sql`.

## Enums

| Enum | Values |
|---|---|
| `platform_role` | `USER`, `PLATFORM_ADMIN`, `SUPER_ADMIN` |
| `account_status` | `ACTIVE`, `SUSPENDED`, `BANNED`, `DELETED` |
| `friendship_status` | `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `BLOCKED` |
| `dm_permission` | `EVERYONE`, `FRIENDS`, `NONE` |
| `event_status` | `DRAFT`, `REGISTRATION_OPEN`, `REGISTRATION_CLOSED`, `SCHEDULING`, `SCHEDULED`, `LIVE`, `COMPLETED`, `CANCELLED`, `ARCHIVED` |
| `event_role` | `EVENT_OWNER`, `EVENT_ADMIN`, `EVENT_MANAGER`, `REFEREE`, `SCORER`, `VOLUNTEER`, `VIEWER` |
| `tournament_format` | `ROUND_ROBIN`, `DOUBLE_ROUND_ROBIN`, `KNOCKOUT`, `GROUP_KNOCKOUT`, `SWISS`, `CUSTOM` |
| `team_member_role` | `CAPTAIN`, `VICE_CAPTAIN`, `PLAYER`, `COACH_MANAGER` |
| `team_member_status` | `INVITED`, `ACCEPTED`, `DECLINED`, `REMOVED`, `LEFT` |
| `registration_status` | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `WITHDRAWN` |
| `player_eligibility_status` | `PENDING_APPROVAL`, `APPROVED`, `SUSPENDED`, `REMOVED` |
| `match_status` | `SCHEDULED`, `READY`, `STARTING`, `FIRST_HALF`, `HALF_TIME`, `SECOND_HALF`, `EXTRA_TIME_FIRST`, `EXTRA_TIME_SECOND`, `PENALTIES`, `FULL_TIME`, `UNDER_REVIEW`, `FINALIZED`, `POSTPONED`, `CANCELLED`, `ABANDONED`, `SUSPENDED`, `FORFEITED` |
| `match_result_type` | `NORMAL`, `EXTRA_TIME`, `PENALTIES`, `FORFEIT`, `WALKOVER` |
| `match_event_type` | `MATCH_STARTED`, `FIRST_HALF_STARTED`, `HALF_TIME`, `SECOND_HALF_STARTED`, `EXTRA_TIME_STARTED`, `FULL_TIME`, `GOAL`, `OWN_GOAL`, `PENALTY_GOAL`, `ASSIST`, `SHOT`, `SHOT_ON_TARGET`, `TACKLE`, `INTERCEPTION`, `CLEARANCE`, `BLOCK`, `SAVE`, `PENALTY_SAVE`, `FOUL_COMMITTED`, `WARNING`, `YELLOW_CARD`, `SECOND_YELLOW`, `RED_CARD`, `SUBSTITUTION`, `INJURY`, `PENALTY_AWARDED`, `PENALTY_SHOOTOUT_KICK`, `MATCH_PAUSED`, `MATCH_RESUMED`, `MATCH_POSTPONED`, `MATCH_CANCELLED`, `MATCH_ABANDONED`, `MATCH_FORFEITED`, `CORRECTION` |
| `match_event_status` | `ACTIVE`, `SUPERSEDED`, `VOIDED` |
| `match_event_source` | `REFEREE`, `SCORER`, `ADMIN_CORRECTION`, `SYSTEM` |
| `official_role` | `REFEREE`, `SCORER`, `VOLUNTEER`, `VENUE_MANAGER`, `MEDICAL`, `PHOTOGRAPHER` |
| `assignment_status` | `ASSIGNED`, `ACCEPTED`, `DECLINED` |
| `stat_category` | `OFFENSIVE`, `DEFENSIVE`, `GOALKEEPER`, `DISCIPLINE`, `MISC` |
| `suspension_reason` | `RED_CARD`, `ACCUMULATED_YELLOW`, `DISCIPLINARY_DECISION` |
| `dispute_status` | `OPEN`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `MODIFIED` |
| `report_target_type` | `USER`, `TEAM`, `MESSAGE`, `EVENT`, `MATCH` |
| `report_status` | `OPEN`, `REVIEWED`, `ACTIONED`, `DISMISSED` |
| `media_owner_type` | `USER_AVATAR`, `TEAM_LOGO`, `EVENT_BANNER`, `EVENT_LOGO`, `MATCH_PHOTO`, `MATCH_VIDEO`, `CERTIFICATE`, `MESSAGE_ATTACHMENT` |
| `media_resource_type` | `image`, `video`, `raw` |
| `notification_type` | `TEAM_REGISTRATION_APPROVED`, `PLAYER_INVITED`, `PLAYER_ACCEPTED`, `ROSTER_INCOMPLETE`, `MATCH_SCHEDULED`, `MATCH_CHANGED`, `MATCH_STARTING_SOON`, `REFEREE_ASSIGNED`, `REFEREE_ACCEPTED`, `MATCH_STARTED`, `MATCH_ENDED`, `TOURNAMENT_COMPLETED`, `FRIEND_REQUEST`, `FRIEND_ACCEPTED`, `DM_RECEIVED` |
| `activity_type` | `PLAYED_MATCH`, `REFEREED_MATCH`, `JOINED_TEAM`, `LEFT_TEAM`, `MVP`, `TOURNAMENT_WIN`, `FRIEND_ADDED`, `ACHIEVEMENT` |

---

## 1. Identity

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | = `auth.users.id` (Supabase Auth) |
| `unique_code` | text unique | e.g. `FTB-X8K29Q`, generated server-side, never the PK |
| `username` | text unique | |
| `display_name` | text | |
| `avatar_media_id` | uuid fk → `media_assets.id`, null | |
| `date_of_birth` | date, null | |
| `gender` | text, null | |
| `phone` | text, null unique | |
| `email` | text unique | mirrors `auth.users.email` |
| `preferred_position` | text, null | |
| `strong_foot` | text, null | `LEFT`/`RIGHT`/`BOTH` |
| `bio` | text, null | |
| `location_text` | text, null | |
| `platform_role` | `platform_role` default `USER` | |
| `account_status` | `account_status` default `ACTIVE` | |
| `email_verified` / `phone_verified` | bool default false | |
| `created_at`, `updated_at` | timestamptz | |

### `user_privacy_settings` (1:1 with `users`)
`user_id` pk/fk · `profile_public` bool · `stats_public` bool · `friends_visible` bool ·
`teams_visible` bool · `match_history_public` bool · `dm_permission` `dm_permission`.

### `friendships`
`id` · `requester_id` fk users · `addressee_id` fk users · `status` `friendship_status` ·
`created_at` · `updated_at`.
**Constraint:** unique on `(least(requester_id,addressee_id), greatest(requester_id,addressee_id))`
— one relationship row per pair, ever (status changes, row doesn't duplicate).

### `blocks`
`id` · `blocker_id` fk users · `blocked_id` fk users · `created_at`. Unique `(blocker_id, blocked_id)`.

### `conversations` / `conversation_members` / `messages`
- `conversations`: `id` · `is_group` bool · `created_at`.
- `conversation_members`: `conversation_id` fk · `user_id` fk · `joined_at` · `last_read_at`.
  PK `(conversation_id, user_id)`.
- `messages`: `id` · `conversation_id` fk · `sender_id` fk · `body` text · `media_id` fk
  `media_assets`, null · `created_at` · `deleted_at`, null.

### `notifications`
`id` · `user_id` fk · `type` `notification_type` · `payload` jsonb · `read_at`, null ·
`created_at`. Index `(user_id, read_at, created_at desc)` for the "unread inbox" query.

### `activity_feed`
`id` · `user_id` fk · `activity_type` `activity_type` · `payload` jsonb · `created_at`.
Index `(user_id, created_at desc)`.

---

## 2. Venues

### `venues`
`id` · `name` · `address` · `latitude` numeric · `longitude` numeric · `created_by` fk users ·
`created_at`.

### `venue_fields`
`id` · `venue_id` fk · `name` (e.g. "Field A") · `surface_type`, null · `notes`, null.

---

## 3. Events

### `events`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `event_code` | text unique | short public code |
| `slug` | text unique | `/events/[slug]` |
| `name`, `description` | text | |
| `logo_media_id`, `banner_media_id` | uuid fk `media_assets`, null | |
| `organizer_id` | fk users | becomes `EVENT_OWNER` in `event_roles` on create |
| `venue_id` | fk `venues`, null | |
| `start_date`, `end_date`, `registration_deadline` | timestamptz | |
| `status` | `event_status` default `DRAFT` | |
| `public_token` | text unique | for `/e/{token}` share links, independent of `slug` |
| `created_at`, `updated_at` | | |

### `event_settings` (1:1 with `events`)
`event_id` pk/fk · `players_on_field` int · `substitutes_allowed` int · `min_squad` int ·
`max_squad` int · `first_half_minutes` int · `second_half_minutes` int · `half_time_minutes` int ·
`extra_time_allowed` bool · `extra_time_minutes` int, null · `penalty_shootout_allowed` bool ·
`max_substitutions` int · `rolling_subs` bool · `injury_time_tracking` bool ·
`buffer_minutes` int · `min_rest_minutes` int · `points_win` int default 3 ·
`points_draw` int default 1 · `points_loss` int default 0 · `fair_play_affects_ranking` bool ·
`fair_play_as_tiebreak` bool · `tie_break_order` jsonb (ordered array, e.g.
`["POINTS","GOAL_DIFFERENCE","GOALS_SCORED","HEAD_TO_HEAD","FAIR_PLAY"]`) ·
`tournament_format` `tournament_format` · `allow_duplicate_jersey_numbers` bool default false.

### `event_roles`
`id` · `event_id` fk · `user_id` fk · `role` `event_role` · `granted_by` fk users ·
`created_at`. Unique `(event_id, user_id, role)`.

### `event_announcements`
`id` · `event_id` fk · `author_id` fk users · `title` · `body` · `is_emergency` bool default
false · `created_at`.

### `event_stat_definitions`
Configurable scoring per §33–36/§94 — **never hard-code point values.**
`id` · `event_id` fk · `stat_key` text (e.g. `GOAL`, `ASSIST`, `SUCCESSFUL_TACKLE`, `SAVE`,
`FOUL`, `YELLOW_CARD`, `RED_CARD`) · `label` text · `category` `stat_category` ·
`points_value` numeric · `affects_fair_play` bool · `fair_play_delta` numeric.
Unique `(event_id, stat_key)`. Seeded with sensible defaults on event creation, editable by
`EVENT_OWNER`/`EVENT_ADMIN` until the event leaves `DRAFT`.

### `event_disciplinary_rules` (1:1 with `events`)
`event_id` pk/fk · `second_yellow_triggers_red` bool default true ·
`red_suspension_matches` int default 1 · `accumulated_yellow_threshold` int default 2 ·
`accumulated_yellow_suspension_matches` int default 1.

---

## 4. Teams

Teams are **persistent entities** that register into many events over time — not
event-scoped rows (this fixes a gap in the original brief where team and event registration
were conflated).

### `teams`
`id` · `slug` unique · `name` · `short_name` · `logo_media_id` fk `media_assets`, null ·
`primary_color`, `secondary_color` text · `description`, null · `instagram_url`,
`website_url`, null · `created_by` fk users · `created_at`.

### `team_members` (the team's home/base squad)
`id` · `team_id` fk · `user_id` fk · `role` `team_member_role` · `status` `team_member_status` ·
`invited_by` fk users, null · `joined_at`, null · `created_at`.
Unique `(team_id, user_id)`.

### `event_team_registrations` (a team entering a specific event)
`id` · `event_id` fk · `team_id` fk · `status` `registration_status` default `DRAFT` ·
`seed` int, null · `group_id` fk `groups`, null · `roster_locked` bool default false ·
`registered_at`, `approved_at`, null · `approved_by` fk users, null.
Unique `(event_id, team_id)`.
Derived/cached (recomputed, see functions below): `played`, `won`, `drawn`, `lost`,
`goals_for`, `goals_against`, `points`, `fair_play_points`.

### `event_team_players` (event-scoped roster + eligibility — supports transfers, §101)
`id` · `event_registration_id` fk `event_team_registrations` · `user_id` fk ·
`jersey_number` int, null · `position` text, null · `status` `player_eligibility_status` ·
`is_captain_for_event` bool default false · `is_vice_captain_for_event` bool default false.
Unique `(event_registration_id, jersey_number)` **unless**
`event_settings.allow_duplicate_jersey_numbers`.
**Cross-table rule (enforced by trigger `trg_enforce_single_team_per_event`):** a `user_id`
may have at most one `event_team_players` row with `status IN ('PENDING_APPROVAL','APPROVED')`
per `event_id` — i.e. a player can't represent two teams in the same tournament.

### `groups`
`id` · `event_id` fk · `name` (e.g. "Group A") · `created_at`.

### `brackets`
`id` · `event_id` fk · `round_name` text (`QF`, `SF`, `FINAL`, `THIRD_PLACE`, custom) ·
`position` int · `home_source` jsonb (`{"type":"team","registration_id":...}` or
`{"type":"winner_of","match_id":...}` or `{"type":"group_position","group_id":...,"position":1}`) ·
`away_source` jsonb (same shape) · `match_id` fk `matches`, null.

---

## 5. Matches

### `matches`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `event_id` | fk | |
| `group_id` | fk `groups`, null | |
| `bracket_id` | fk `brackets`, null | |
| `home_registration_id`, `away_registration_id` | fk `event_team_registrations` | |
| `venue_field_id` | fk `venue_fields`, null | |
| `scheduled_start` | timestamptz | |
| `status` | `match_status` default `SCHEDULED` | see doc 06 for the transition table |
| `match_started_at`, `half_started_at`, `paused_at`, `resumed_at` | timestamptz, null | authoritative clock anchors — §29 |
| `first_half_injury_seconds`, `second_half_injury_seconds` | int default 0 | |
| `home_score`, `away_score` | int default 0 | **derived cache**, maintained by trigger, never written directly by the app |
| `winner_registration_id` | fk, null | |
| `result_type` | `match_result_type`, null | |
| `created_at`, `updated_at` | | |

### `match_officials`
`id` · `match_id` fk · `user_id` fk · `role` `official_role` ·
`assignment_status` `assignment_status` default `ASSIGNED` · `assigned_by` fk users.

### `match_lineups`
`id` · `match_id` fk · `event_team_player_id` fk · `is_starting` bool ·
`is_captain_for_match` bool default false · `jersey_number_override` int, null.

### `match_events` — the append-only event log (§81–83, the most important table in the schema)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `match_id` | fk | |
| `event_type` | `match_event_type` | |
| `client_event_id` | uuid **unique** | idempotency key generated by the caller (§86) |
| `actor_id` | fk users | who recorded it |
| `actor_role` | text | snapshot of the role at time of recording, for audit clarity |
| `player_id` | fk `event_team_players`, null | |
| `related_player_id` | fk `event_team_players`, null | assist-to / substituted-in-for |
| `team_registration_id` | fk `event_team_registrations`, null | |
| `minute` | int, null | |
| `injury_time_minute` | int, null | |
| `match_clock_seconds` | int, null | |
| `payload` | jsonb | free-form extra detail: goal type, card reason, sub in/out ids, penalty result |
| `status` | `match_event_status` default `ACTIVE` | |
| `superseded_by_event_id` | fk `match_events`, null | a `WARNING` is superseded by a later `YELLOW_CARD`, never deleted (§31) |
| `source` | `match_event_source` | |
| `created_at` | timestamptz | |
| `synced_at` | timestamptz, null | set when an offline-queued event is confirmed by the server |

Indexes: unique `(client_event_id)`; `(match_id, created_at)`; `(match_id, event_type)`;
`(player_id)`.

---

## 6. Statistics (all derived — see "Functions & triggers" below)

- **`player_match_stats`**: `match_id`, `event_team_player_id` (PK pair) · counts for every
  `stat_key` relevant to a match (`goals`, `assists`, `shots`, `shots_on_target`, `tackles`,
  `interceptions`, `clearances`, `saves`, `fouls_committed`, `fouls_won`, `yellow_cards`,
  `red_cards`, `warnings`) · `performance_points` numeric · `is_mvp` bool.
- **`team_match_stats`**: `match_id`, `event_registration_id` (PK pair) · `shots`,
  `shots_on_target`, `fouls`, `possession_pct` (null unless captured) · `fair_play_points`.
- **`player_event_stats`**: `event_id`, `user_id` (PK pair) · `matches_played`, `goals`,
  `assists`, `tackles`, `saves`, `yellow_cards`, `red_cards`, `mvp_count`, `fair_play_score`,
  `total_performance_points`.
- **`player_career_stats`**: `user_id` PK · lifetime totals · `updated_at`.

## 7. Tournament

- **`standings`** view/table over `event_team_registrations` derived fields, materialized per
  `(event_id, group_id)` and ordered by `event_settings.tie_break_order`.
- **`groups`**, **`brackets`** — see §4 above.

## 8. Discipline & integrity

### `suspensions`
`id` · `event_team_player_id` fk · `reason` `suspension_reason` · `matches_remaining` int ·
`triggered_by_match_event_id` fk `match_events` · `created_at` · `cleared_at`, null.

## 9. Achievements

- **`achievements`**: `id` · `key` (`CHAMPION`, `RUNNER_UP`, `GOLDEN_BOOT`, `GOLDEN_GLOVE`,
  `MVP`, `BEST_DEFENDER`, `TOP_ASSIST`, `FAIR_PLAY_AWARD`) · `label` · `icon`.
- **`player_achievements`**: `id` · `user_id` fk · `event_id` fk, null · `achievement_id` fk ·
  `awarded_at` · `featured` bool default false (§55 — max 3 enforced in the API layer).
- **`team_achievements`**: `id` · `team_id` fk · `event_id` fk · `achievement_id` fk ·
  `awarded_at`.

## 10. Trust & moderation

### `audit_logs`
`id` · `actor_id` fk users · `action` text · `entity_type` text · `entity_id` uuid ·
`old_value` jsonb · `new_value` jsonb · `reason` text, null · `created_at`.
Every FastAPI write handler that mutates a trusted table writes exactly one row here in the
same transaction.

### `disputes`
`id` · `match_id` fk · `raised_by` fk users · `category` text · `description` text ·
`evidence_media_ids` jsonb (array of `media_assets.id`) · `status` `dispute_status` ·
`resolution_notes`, null · `resolved_by` fk users, null · `resolved_at`, null · `created_at`.

### `reports`
`id` · `reporter_id` fk users · `target_type` `report_target_type` · `target_id` uuid ·
`reason` text · `description` text, null · `status` `report_status` default `OPEN` ·
`reviewed_by` fk users, null · `created_at`.

## 11. Media (Cloudinary-backed — see doc 06 for the full flow)

### `media_assets`
`id` · `owner_type` `media_owner_type` · `owner_id` uuid ·
`cloudinary_public_id` text unique · `secure_url` text · `resource_type`
`media_resource_type` · `width`, `height` int, null · `format` text · `bytes` int ·
`uploaded_by` fk users · `tags` text[] · `created_at`.
No file bytes ever touch Postgres or FastAPI — this table is metadata only.

## 12. Idempotency (general-purpose, beyond `match_events.client_event_id`)

### `idempotency_keys`
`key` uuid pk · `endpoint` text · `response_snapshot` jsonb · `created_at`.
Used by any FastAPI mutation endpoint that isn't already covered by a natural unique
constraint (e.g. team-registration submission, schedule acceptance).

---

## Functions & triggers (Postgres, no external worker needed)

| Function | Fired by | Does |
|---|---|---|
| `fn_recompute_match_score(match_id)` | `AFTER INSERT OR UPDATE` on `match_events` where `event_type IN ('GOAL','OWN_GOAL','PENALTY_GOAL')` and `status='ACTIVE'` | Recounts goals per side, updates `matches.home_score/away_score` |
| `fn_recompute_player_match_stats(match_id)` | same trigger, broader `event_type` set | Re-aggregates every active `match_events` row for the match into `player_match_stats`, applying `event_stat_definitions.points_value` for `performance_points` |
| `fn_apply_disciplinary_effects(match_event_id)` | `AFTER INSERT` on `match_events` where `event_type IN ('YELLOW_CARD','SECOND_YELLOW','RED_CARD')` | Applies `event_disciplinary_rules`, may insert a `suspensions` row, may synthesize a `SECOND_YELLOW`→`RED_CARD` correction event |
| `fn_recompute_standings(event_id)` | `AFTER UPDATE` on `matches` where `status` transitions to `FINALIZED` | Recomputes `event_team_registrations` derived columns and orders per `tie_break_order` |
| `fn_recompute_player_career_stats(user_id)` | `AFTER UPDATE` on `player_event_stats`, or nightly via `pg_cron` | Rolls event-level stats into `player_career_stats` |
| `set_updated_at()` | generic `BEFORE UPDATE` on every mutable table | Bumps `updated_at` |

Recomputation is always **idempotent and safe to re-run from `match_events` alone** — if a
scoring rule changes, call `fn_recompute_player_match_stats` for every affected match instead
of patching numbers by hand.

## RLS pattern (representative examples — full policy set lives in the migrations)

```sql
-- users: anyone can read public profile columns, only the owner can update their own row
create policy "profiles are publicly readable"
  on users for select
  using (true);

create policy "users can update their own row"
  on users for update
  using (auth.uid() = id);

-- event_roles: only existing EVENT_OWNER/EVENT_ADMIN of that event can grant a role
create policy "event admins manage roles"
  on event_roles for insert
  using (
    exists (
      select 1 from event_roles er
      where er.event_id = event_roles.event_id
        and er.user_id = auth.uid()
        and er.role in ('EVENT_OWNER','EVENT_ADMIN')
    )
  );

-- match_events: read is open to anyone who can see the match; INSERT is blocked entirely —
-- only the FastAPI service-role key may insert, after its own authorization checks
create policy "match events are publicly readable"
  on match_events for select
  using (true);

revoke insert, update, delete on match_events from authenticated, anon;
```

The last pattern — **revoke direct client writes, force privileged mutation through the
service-role key used only by FastAPI** — applies to `matches`, `match_events`,
`event_team_registrations`, `event_team_players`, `suspensions`, `standings`-affecting columns,
and `audit_logs`. Everything else (profiles, friendships, messages, own team's non-locked
roster edits) is safe to leave to RLS alone.
