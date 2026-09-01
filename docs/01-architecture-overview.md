# 01 — Architecture Overview

## 1. The split that drives everything

Three actors, three jobs:

```text
BROWSER (Next.js)              SUPABASE                        FASTAPI (Render)
────────────────────────       ────────────────────────        ────────────────────────
- Render UI                    - Postgres (source of truth)    - Privileged writes
- Optimistic UI                - Auth (JWT issuance)            - Business-rule validation
- Schedule generation          - Realtime (Postgres changes,    - Cross-entity checks
- Countdown/clock display        Broadcast, Presence)           - Moderation / disputes
- Charts, CSV/PDF export       - RLS (row-level authorization)  - Cloudinary signing
- Image compression            - Direct reads for ~everything   - Stat-rule recomputation
- IndexedDB offline queue         public or "owns the row"        triggers (via Postgres fns)
```

**Rule of thumb:** if an operation only needs "is this the owner of this row?", it goes straight
from the browser to Supabase, protected by RLS. If it needs "is this row in a state that allows
this transition, and does this cross-check against three other tables pass?", it goes through
FastAPI. FastAPI does not proxy reads — it exists for the ~20% of operations where trust matters.

## 2. Request flow example: recording a goal

This is the canonical flow every other trusted mutation follows.

```text
Referee taps "GOAL" on the match-centre UI
        │
        ▼
Browser generates client_event_id (UUID v4)
        │
        ▼
Optimistic UI: score +1, event appended to local timeline immediately
        │
        ▼
POST /matches/{id}/events  →  FastAPI
        │  (JWT verified, role checked: is caller REFEREE/SCORER/EVENT_ADMIN for this match?)
        │  (business checks: match.status is a LIVE-ish state; player belongs to a team
        │   registered in this match; player is not suspended; client_event_id not seen before)
        ▼
INSERT INTO match_events (...) — via Supabase service-role client
        │
        ▼
Postgres trigger: fn_recompute_match_score(match_id)
Postgres trigger: fn_recompute_player_match_stats(match_id)
Postgres trigger: fn_apply_disciplinary_effects(...)  [only for card events]
        │
        ▼
Supabase Realtime broadcasts the Postgres change on match_events / matches
        │
        ▼
Every subscribed client (referee's own second device, admin dashboard, spectators on
/match/[id]) receives the update and re-renders — no polling, no custom WebSocket server
```

If the referee's phone is offline when they tap GOAL, the event sits in an IndexedDB queue
(doc 06) and replays the same `POST /matches/{id}/events` call once connectivity returns, using
the same `client_event_id` so a retry can never double-count.

## 3. What goes through FastAPI vs. straight through Supabase

| Goes through FastAPI (trust boundary) | Goes straight from browser → Supabase (RLS-protected) |
|---|---|
| Create/configure event, change event status | Read anything public (events, teams, matches, stats, standings, leaderboards, profiles) |
| Approve/reject team registration, lock roster | Send/accept/reject/cancel a friend request |
| Assign/accept referee, scorer, official | Send/read a DM in a conversation you belong to |
| Start/pause/resume/finalize a match (state machine transitions) | Edit your own profile / privacy settings |
| Record a match event (goal, card, sub, foul, injury...) | Mark a notification as read |
| Accept a generated schedule / persist match slots | Post a (non-emergency) team update visible only to your own team |
| Disciplinary/suspension processing, disputes, moderation | Realtime subscriptions (postgres_changes, presence, broadcast channels) |
| Cloudinary signature generation + asset deletion | Insert a `media_assets` row for your own avatar/team logo (RLS checks ownership) |
| Recompute/regenerate standings, awards, career stats | — |

Full endpoint-by-endpoint detail is in doc 05.

## 4. Source data vs. derived data

This distinction (from the brief, §122/§139) is load-bearing for the whole schema:

- **Events** — something happened: `match_events` rows. Append-only. Never mutated, only
  superseded (a card supersedes a warning; a correction supersedes a wrong entry).
- **Statistics** — what those events produced: `player_match_stats`, `team_event_stats`
  (standings), `player_career_stats`. Always *derived*, always recomputable from
  `match_events` by re-running the Postgres functions in doc 02.
- **Ratings** — the scoring model's interpretation: `performance_points`, MVP, fair-play score.
  Computed from statistics using event-configurable weights in `event_stat_definitions`, never
  hard-coded.

If a tournament's scoring rules change mid-event, you re-run `fn_recompute_player_match_stats`
for every match — you never touch `match_events`.

## 5. State, not booleans

Every long-lived entity that matters for integrity (`matches`, `event_team_registrations`,
`event_team_players`, `friendships`, `events`) is modeled as an explicit enum state machine, not
a scattering of boolean flags (`is_approved`, `is_locked`, `is_live`...). State machines are
fully specified in doc 06. This is what makes audit logs and disputes possible — every state
transition is one row in `audit_logs`, not an untraceable field update.

## 6. Multi-tenancy shape

- **Platform role** (`users.platform_role`): `USER`, `PLATFORM_ADMIN`, `SUPER_ADMIN` — rare,
  cuts across all events.
- **Event role** (`event_roles`): `EVENT_OWNER`, `EVENT_ADMIN`, `EVENT_MANAGER`, `REFEREE`,
  `SCORER`, `VOLUNTEER`, `VIEWER` — scoped to one event.
- **Team role** (`team_members.role`): `CAPTAIN`, `VICE_CAPTAIN`, `PLAYER`, `COACH_MANAGER` —
  scoped to one team, which itself can be registered in many events over time.

A single person can be an `EVENT_OWNER` of one tournament, a `REFEREE` in another, and a
`PLAYER` on two different teams, simultaneously. No table encodes "the admin" as a global
concept.

## 7. What's deliberately deferred out of v1

Open commenting (moderation cost, §76), Swiss-format scheduling, follow-vs-friend split (§70),
digital certificate generation as a first-class feature (browser can already produce a PDF from
data you already have), typing indicators. All are additive later — nothing in the schema (doc
02) blocks adding them.

## 8. Non-FastAPI background work

Per the brief's Render constraint (§123–124), there is **no Celery/worker fleet in v1**.
Derived-data recomputation (score, stats, standings) happens via Postgres triggers/functions
(doc 02, §"Functions & triggers") — synchronous, transactional, and free of a queue to operate.
Anything genuinely asynchronous and non-urgent (nightly career-stat rollups, stale-notification
cleanup) can use `pg_cron` inside Supabase rather than a Render worker.
