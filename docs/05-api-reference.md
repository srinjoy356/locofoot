# 05 — API Reference

Legend: **FastAPI** = trusted mutation, goes through `apps/api`. **Supabase direct** = browser
calls Supabase (with RLS) or Realtime directly — no FastAPI route exists for it, listed here
only so nothing is accidentally built twice.

## Auth & Users

| Method & Path | Layer | Purpose |
|---|---|---|
| — | Supabase direct | Sign up / login / OTP / OAuth — handled entirely by Supabase Auth |
| `GET /users/me` | Supabase direct | Read own profile |
| `PATCH /users/me` | Supabase direct | Edit own profile (RLS: `auth.uid() = id`) |
| `GET /users/search?q=` | Supabase direct | Search by `unique_code`/`username`/`name` |
| `PATCH /users/me/privacy` | Supabase direct | Update `user_privacy_settings` |
| `POST /admin/users/{id}/suspend` | **FastAPI** | Platform moderation — role-gated to `PLATFORM_ADMIN`/`SUPER_ADMIN`, writes `audit_logs` |

## Friends & Messaging

| Method & Path | Layer | Purpose |
|---|---|---|
| `POST /friendships` | Supabase direct | Send request (insert row, RLS: requester = `auth.uid()`) |
| `PATCH /friendships/{id}` | Supabase direct | Accept/reject/cancel/remove (RLS: participant only) |
| `POST /blocks` | Supabase direct | Block a user |
| `POST /conversations` | Supabase direct | Start a DM (RLS requires an accepted friendship, or `dm_permission='EVERYONE'`) |
| `POST /messages` | Supabase direct | Send message (RLS: sender is a conversation member) |
| `PATCH /conversation_members/{id}` | Supabase direct | Update `last_read_at` |

## Notifications & Activity

| Method & Path | Layer | Purpose |
|---|---|---|
| `GET /notifications` | Supabase direct | Paginated inbox |
| `PATCH /notifications/{id}` | Supabase direct | Mark read |
| — | Supabase Realtime | New notifications pushed via `postgres_changes` on `notifications` |
| `GET /users/{id}/activity` | Supabase direct | Public activity feed, respecting privacy settings |

## Events

| Method & Path | Layer | Purpose |
|---|---|---|
| `GET /events`, `GET /events/{slug}` | Supabase direct | Public reads |
| `POST /events` | **FastAPI** | Create event; creator becomes `EVENT_OWNER` in `event_roles`; seeds default `event_stat_definitions` |
| `PATCH /events/{id}` | **FastAPI** | Edit event; blocks certain field changes once `status != DRAFT` |
| `POST /events/{id}/status` | **FastAPI** | Explicit status transition (`DRAFT→REGISTRATION_OPEN→...`), validates preconditions per transition |
| `PATCH /events/{id}/settings` | **FastAPI** | Edit `event_settings` — locked once `SCHEDULING` begins |
| `PUT /events/{id}/stat-definitions` | **FastAPI** | Replace scoring rules — locked once event leaves `DRAFT` |
| `POST /events/{id}/roles` | **FastAPI** | Grant `EVENT_ADMIN`/`REFEREE`/etc. — only existing `EVENT_OWNER`/`EVENT_ADMIN` may call |
| `POST /events/{id}/announcements` | **FastAPI** | Post announcement; `is_emergency=true` also fans out a push notification |

## Teams & Rosters

| Method & Path | Layer | Purpose |
|---|---|---|
| `POST /teams` | Supabase direct | Create a persistent team (creator becomes `CAPTAIN` in `team_members`) |
| `PATCH /teams/{id}` | Supabase direct | Edit team profile (RLS: captain only) |
| `POST /teams/{id}/members` | Supabase direct | Invite to home squad (requires friendship, per the brief's rule) |
| `POST /events/{id}/registrations` | **FastAPI** | Register a team into an event (creates `event_team_registrations`, copies eligible members into `event_team_players` as `PENDING_APPROVAL`) |
| `POST /registrations/{id}/submit` | **FastAPI** | Captain submits roster once `min_squad` reached |
| `POST /registrations/{id}/approve` | **FastAPI** | Organizer approves → `APPROVED`, may trigger `roster_locked` |
| `POST /registrations/{id}/lock` | **FastAPI** | Explicit roster lock; further edits require `admin override` reason |
| `PATCH /event-team-players/{id}` | **FastAPI** | Jersey number / position edits; blocked once roster is locked unless caller is admin (reason required, logged) |
| `POST /event-team-players/{id}/withdraw` | **FastAPI** | Team withdrawal mid-event → `WITHDRAWN`, never deleted |

## Scheduling

| Method & Path | Layer | Purpose |
|---|---|---|
| — | Browser only | Candidate schedule generation (`lib/scheduling/*`) — pure client-side, no network call |
| `POST /events/{id}/schedule/validate` | **FastAPI** | Server re-validates a candidate schedule (rest constraints, field conflicts, total-time feasibility) before persisting |
| `POST /events/{id}/schedule/accept` | **FastAPI** | Persists the validated schedule as `matches` + slot times, moves event to `SCHEDULED` |
| `POST /events/{id}/schedule/delay` | **FastAPI** | Propagate a delay across subsequent slots (§63) |

## Matches — lifecycle

| Method & Path | Layer | Purpose |
|---|---|---|
| `GET /matches/{id}` | Supabase direct | Public match read (score, lineups, officials) |
| `POST /matches/{id}/officials` | **FastAPI** | Assign referee/scorer/etc. |
| `POST /matches/{id}/officials/{officialId}/respond` | **FastAPI** | Accept/decline assignment |
| `POST /matches/{id}/lineups` | **FastAPI** | Submit starting XI + subs, validates squad eligibility |
| `POST /matches/{id}/ready` | **FastAPI** | Referee + organizer confirm pre-game checklist (§26) |
| `POST /matches/{id}/start` | **FastAPI** | `SCHEDULED/READY → STARTING/FIRST_HALF`, stamps `match_started_at` |
| `POST /matches/{id}/half-time` | **FastAPI** | `FIRST_HALF → HALF_TIME`, records injury time |
| `POST /matches/{id}/resume` | **FastAPI** | `HALF_TIME → SECOND_HALF`, etc. through extra time/penalties |
| `POST /matches/{id}/pause` / `/resume-play` | **FastAPI** | Weather/injury stoppage (§132), stamps `paused_at`/`resumed_at` |
| `POST /matches/{id}/full-time` | **FastAPI** | `→ FULL_TIME → UNDER_REVIEW` |
| `POST /matches/{id}/finalize` | **FastAPI** | `UNDER_REVIEW → FINALIZED`; triggers standings/stat recompute |
| `POST /matches/{id}/postpone` \| `/cancel` \| `/abandon` \| `/forfeit` | **FastAPI** | Exceptional-state transitions (§48–49), reason required, audited |
| `POST /matches/{id}/correction` | **FastAPI** | Admin correction mode (§92) — always requires `reason`, always audited |

## Match Events (goals, cards, etc.)

| Method & Path | Layer | Purpose |
|---|---|---|
| `POST /matches/{id}/events` | **FastAPI** | The core trust-boundary call — see doc 03 service sketch. Body includes `client_event_id`, `event_type`, `player_id`, `payload` |
| `GET /matches/{id}/events` | Supabase direct | Public paginated timeline read (cursor pagination, §114) |
| `PATCH /match-events/{id}` | **FastAPI** | Scorer/admin correction — creates a new event with `status=ACTIVE` and marks the old one `SUPERSEDED`, never an in-place edit |

## Standings & Leaderboards

| Method & Path | Layer | Purpose |
|---|---|---|
| `GET /events/{id}/standings` | Supabase direct | Reads the derived, tie-break-ordered table |
| `POST /events/{id}/standings/recompute` | **FastAPI** | Manual re-trigger (e.g. after a scoring-rule change) |
| `GET /events/{id}/leaderboards?type=` | Supabase direct | `goals`, `assists`, `saves`, `fair-play`, `mvp`, etc. — all reads |

## Disciplinary & Disputes

| Method & Path | Layer | Purpose |
|---|---|---|
| `GET /events/{id}/disciplinary` | Supabase direct | Active suspensions, accumulated yellows |
| `POST /disputes` | **FastAPI** | Raise a dispute against a finalized match |
| `POST /disputes/{id}/resolve` | **FastAPI** | Organizer approves/rejects/modifies; a `MODIFIED` resolution re-opens the match to `UNDER_REVIEW` |
| `POST /reports` | Supabase direct | User/team/message/event/match report (simple insert, RLS-protected) |
| `POST /admin/reports/{id}/action` | **FastAPI** | Platform moderation action on a report |

## Media (Cloudinary)

| Method & Path | Layer | Purpose |
|---|---|---|
| `POST /media/signature` | **FastAPI** | Signs an upload for a given `owner_type`/`owner_id`/folder — never exposes the API secret |
| — | Browser → Cloudinary directly | The actual file upload |
| `INSERT media_assets` | Supabase direct | Persist metadata after a successful Cloudinary upload (RLS checks the caller owns `owner_id`) |
| `DELETE /media/{id}` | **FastAPI** | Authorizes, calls `cloudinary.uploader.destroy`, deletes the row — deletion is never client-direct |

## Admin / Platform

| Method & Path | Layer | Purpose |
|---|---|---|
| `GET /admin/events/{id}/dashboard` | **FastAPI** | Aggregated command-centre payload (§66/§131) — cheap enough to be Supabase direct too, but kept in FastAPI if it later needs cross-event platform metrics |
| `GET /admin/audit-logs` | **FastAPI** | Filtered audit trail view, `PLATFORM_ADMIN`/event-admin scoped |
| `POST /admin/events/{id}/archive` | **FastAPI** | `COMPLETED → ARCHIVED`, never deletes |
