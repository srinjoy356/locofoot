# 07 — Implementation Roadmap

Each phase lists exactly which tables (doc 02), backend files (doc 03), frontend routes
(doc 04), and endpoints (doc 05) it introduces, plus what "done" means before moving on.
Do not start a phase's UI before its tables and trusted endpoints exist — the point of the
architecture is that the client is never the source of truth, so building the client first
just produces throwaway mock logic.

## Phase 0 — Foundations (infra, before any feature)

**Build:**
- Monorepo scaffold (`apps/web`, `apps/api`, `supabase/`, `packages/shared-types`)
- Supabase project + `users`, `user_privacy_settings` tables, Auth wired up (email/password
  first; Google + OTP can follow)
- FastAPI skeleton: `main.py`, `config.py`, `core/security.py`, `core/supabase_client.py`,
  `core/exceptions.py`, health-check route
- Cloudinary account + `media_assets` table + `/media/signature` + `ImageUploader.tsx` +
  avatar upload end-to-end (this is the smallest possible slice that proves the whole
  browser→Cloudinary→Supabase→FastAPI chain works)
- CI: lint, typecheck, migration lint on both apps

**Done when:** a user can sign up, log in, upload and see their own avatar, and the FastAPI
health check + JWT verification work against a real Supabase JWT.

## Phase 1 — Identity & Social (§ Phase 1 of the original brief)

**Tables:** `friendships`, `blocks`, `conversations`, `conversation_members`, `messages`,
`notifications`.
**Frontend:** `(dashboard)/friends`, `(dashboard)/messages/[conversationId]`,
`(dashboard)/notifications`, `useRealtimeMatch`-style hook reused as `useRealtimeConversation`.
**Backend:** none required yet — everything here is Supabase-direct + RLS per doc 05.

**Done when:** two users can become friends, DM each other in realtime, and receive a
notification, entirely without a FastAPI round-trip.

## Phase 2 — Events & Team Registration

**Tables:** `venues`, `venue_fields`, `events`, `event_settings`, `event_roles`,
`event_stat_definitions`, `event_disciplinary_rules`, `teams`, `team_members`,
`event_team_registrations`, `event_team_players`.
**Backend:** `routers/events.py`, `routers/event_roles.py`, `routers/teams.py`,
`routers/team_rosters.py`, `services/event_service.py`, `services/team_service.py`,
`services/roster_service.py`.
**Frontend:** `(admin)/admin/events/[eventId]/{page,registrations,settings}`,
`(captain)/teams/[teamId]/{roster,invitations,register/[eventId]}`,
`(public)/events/[slug]/{overview,teams}`.

**Done when:** an organizer can create and configure an event, a captain can build a team,
register it, invite players (friendship-gated, per the brief), submit a roster, and the
organizer can approve it and lock it.

## Phase 3 — Competition Engine (scheduling & standings)

**Tables:** `groups`, `brackets`, `matches` (creation only — lifecycle comes in Phase 4).
**Backend:** `routers/scheduling.py`, `services/scheduling_service.py`,
`services/standings_service.py`.
**Frontend:** `lib/scheduling/{roundRobinGenerator,knockoutGenerator,slotCalculator}.ts`,
`components/events/ScheduleGeneratorWizard.tsx`, `(admin).../schedule`,
`(public)/events/[slug]/{fixtures,standings}`.

**Done when:** the admin can generate a full round-robin or knockout schedule client-side, see
a feasibility warning if the time window is too tight (§10), and accept it — persisting real
`matches` rows through `POST /events/{id}/schedule/accept`.

## Phase 4 — Match Centre (the core of the product)

**Tables:** `match_officials`, `match_lineups`, `match_events`, `player_match_stats`,
`team_match_stats`, `suspensions`. Postgres functions:
`fn_recompute_match_score`, `fn_recompute_player_match_stats`,
`fn_apply_disciplinary_effects`.
**Backend:** `routers/matches.py`, `routers/match_events.py`, `routers/referees.py`,
`services/match_lifecycle_service.py`, `services/match_event_service.py`,
`services/disciplinary_service.py`, `core/permissions.py`, `core/idempotency.py`.
**Frontend:** `(referee)/referee/{assignments,match/[matchId]}`,
`components/referee/{ScorePad,MatchClock,OfflineBanner}.tsx`, `lib/offline/*`,
`(public)/match/[matchId]`, `components/match/{LiveScoreHeader,Timeline,Lineups,StatsPanel}.tsx`.

**Done when:** a referee can run a full match end-to-end — pre-game checklist, start, goals,
cards (with warning→card supersession working), half-time, full-time, finalize — with a
spectator watching the same match update live via Realtime, and the whole flow surviving an
airplane-mode test on the referee's device.

## Phase 5 — Statistics & Leaderboards

**Tables:** `player_event_stats`, `player_career_stats`, `achievements`,
`player_achievements`, `team_achievements`. Function: `fn_recompute_player_career_stats`.
**Backend:** `routers/standings.py`, `routers/leaderboards.py`, `services/awards_service.py`.
**Frontend:** `(public)/events/[slug]/leaderboards`, `(public)/players/[uniqueCode]` (career
section), fair-play leaderboard, MVP breakdown component (§41).

**Done when:** finishing a tournament auto-generates standings, MVPs per match, and
tournament-level awards (Champion, Golden Boot, Fair Play), all traceable back to specific
`match_events` rows if anyone asks "why."

## Phase 6 — Live & Operational Polish

**Tables:** `event_announcements`, `disputes`, `reports`, `audit_logs` (audit logging should
actually be threaded through every phase above from Phase 2 onward — called out here as the
checkpoint to verify coverage).
**Backend:** `routers/disputes.py`, `routers/reports.py`, `services/dispute_service.py`,
presence-based viewer count wiring.
**Frontend:** `(admin).../matchday` command centre, `(admin).../disciplinary`,
`(admin).../disputes`, emergency announcement broadcast UI, `usePresence.ts` live viewer count.

**Done when:** the organizer has one screen showing every field's live status, can broadcast
an emergency announcement, and a disputed result can be reopened, corrected, and re-finalized
without losing the original data.

## Phase 7 — Platform / Discovery

**Frontend only, mostly:** `(public)/explore`, public team/player profile polish, share
sheets + QR codes (`components/shared/{ShareSheet,QRCodeBlock}.tsx`), CSV/PDF export
(client-side generation from already-fetched data, per §80/§123).

**Done when:** the platform works as a destination, not just an organizer tool — someone can
land on `/explore`, find a live match, watch it, and share it, without ever having created an
account.

---

## Cross-cutting checklist (verify at the end of every phase, not just once)

- [ ] Every new trusted mutation in `services/*.py` follows the five-step shape from doc 03
      (state guard → permission guard → cross-entity guard → idempotent write → audit log).
- [ ] Every new table has an explicit RLS policy — "forgot to add a policy" defaults to
      **no access**, which fails loudly, but confirm it's the *intended* policy, not just
      "make it work" with `using (true)`.
- [ ] Nothing new was added to `match_events` write access for `authenticated`/`anon` roles —
      it stays FastAPI-service-role-only.
- [ ] New derived-data fields have a corresponding recompute function, not a value written
      once and left to drift.
- [ ] New image/video fields go through the Cloudinary signature flow — no direct
      Supabase Storage bucket is ever introduced.
