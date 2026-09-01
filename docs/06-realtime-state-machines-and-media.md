# 06 — Realtime, State Machines, Offline Sync & Media (Cloudinary)

## 1. Supabase Realtime channel design

No custom WebSocket server exists anywhere in this stack (§22/§84). Every live feature is one
of three Supabase Realtime primitives:

| Channel | Primitive | Subscribers | Payload |
|---|---|---|---|
| `match:{matchId}` | `postgres_changes` on `match_events`, `matches` | Referee's own devices, spectators on `/match/[id]`, admin matchday board | New events, score/status changes |
| `event:{eventId}:schedule` | `postgres_changes` on `matches` (filtered by `event_id`) | Fixture list pages, admin schedule page | Slot time/status changes, delay propagation |
| `event:{eventId}:announcements` | `postgres_changes` on `event_announcements` | Every page under `/events/[slug]/*` | New announcement, emergency flag |
| `conversation:{id}` | `postgres_changes` on `messages` | DM participants | New message |
| `match:{matchId}:presence` | Presence | Spectators on the live match page | Join/leave → live viewer count (§23) — **never** written to Postgres per-tick |
| `notifications:{userId}` | `postgres_changes` on `notifications` | The logged-in user, any page | New notification |

**Presence vs. persisted viewer count:** presence gives an ephemeral "184 watching" number for
free from connected sockets. If a historical "unique viewers" figure is ever needed for
post-event analytics (§67), that's a single `INSERT` on page-load into a lightweight
`match_views` table — not a continuously updated counter.

## 2. Match state machine

```text
SCHEDULED → READY → STARTING → FIRST_HALF → HALF_TIME → SECOND_HALF
                                                              │
                                    ┌─────────────────────────┘
                                    ▼
                         FULL_TIME (if scores level & knockout & extra time allowed)
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                              ▼
          EXTRA_TIME_FIRST → EXTRA_TIME_SECOND    PENALTIES
                     │                              │
                     └──────────────┬───────────────┘
                                    ▼
                              FULL_TIME → UNDER_REVIEW → FINALIZED

Exceptional, reachable from most "in progress" states:
  POSTPONED · CANCELLED · ABANDONED · SUSPENDED · FORFEITED
```

| Transition | Triggered by | Guard |
|---|---|---|
| `SCHEDULED → READY` | Referee + organizer confirm pre-game checklist | Both squads confirmed present, lineups submitted |
| `READY → STARTING → FIRST_HALF` | `POST /matches/{id}/start` | Caller has `MatchAction.START_MATCH` for this match |
| `FIRST_HALF → HALF_TIME` | Referee | Injury time recorded |
| `HALF_TIME → SECOND_HALF` | Referee | — |
| `SECOND_HALF → FULL_TIME` | Referee | — |
| `FULL_TIME → EXTRA_TIME_FIRST` | Referee/admin | Draw + `event_settings.extra_time_allowed` + knockout match |
| `... → PENALTIES` | Referee/admin | Still level + `penalty_shootout_allowed` |
| `FULL_TIME/PENALTIES → UNDER_REVIEW` | Automatic on full-time confirmation | — |
| `UNDER_REVIEW → FINALIZED` | Organizer | Referee has confirmed score/cards/players correct (§40) |
| `* → POSTPONED/CANCELLED/ABANDONED/FORFEITED` | Event admin | Reason required, always audited |
| `FINALIZED → UNDER_REVIEW` | Dispute resolved as `MODIFIED` | Re-triggers stat/standings recompute on re-finalize |

Any transition attempted outside this table is rejected by `match_lifecycle_service` before it
ever reaches the database — this is what "the browser cannot corrupt the match" means in
practice.

## 3. Match-event correction state machine (§31, §92)

```text
WARNING ──(a card is later issued to the same player/incident)──▶ status = SUPERSEDED
                                                                    superseded_by_event_id = <card row>
CARD/GOAL/etc. ──(admin correction)──▶ old row: status = SUPERSEDED
                                       new row: status = ACTIVE, source = ADMIN_CORRECTION
```

Nothing is ever `DELETE`d from `match_events`. `player_match_stats`/`team_match_stats`
recomputation only sums rows where `status = 'ACTIVE'`, so a superseded row silently stops
counting without losing the audit trail.

## 4. Idempotency

- **Match events**: `client_event_id` (UUID, generated client-side at the moment the referee
  taps a button) is a unique DB constraint on `match_events`. A retried `POST` with the same id
  either fails the insert with a unique-violation (caught and treated as success — see the
  service sketch in doc 03) or, if it already succeeded and the client just didn't get the
  response, returns the same row.
- **Everything else mutation-shaped** (schedule acceptance, registration submission, dispute
  resolution): callers pass an `Idempotency-Key` header; FastAPI checks `idempotency_keys`
  before executing, and stores the response snapshot after, so a doubled network request never
  doubles the effect.

## 5. Offline referee mode

```text
Referee taps GOAL
        │
        ▼
IndexedDB: pendingEvents.add({ clientEventId, matchId, eventType, payload, queuedAt })
        │
        ▼
Optimistic UI update (score, timeline) — immediate, regardless of connectivity
        │
        ▼
navigator.onLine? ──no──▶ stay queued, listen for `online` event
        │yes
        ▼
POST /matches/{id}/events  (same clientEventId on every attempt)
        │
   success ──▶ delete from pendingEvents
        │
   network error ──▶ leave queued, retry later
        │
   4xx (permission/state error) ──▶ surface to referee UI, do NOT silently drop — a card
                                     mis-recorded because the match had already been finalized
                                     needs a human to look at it, not a silent retry loop
```

**Conflict resolution (§89):** if both a referee's queued event and an admin's live correction
land for the same real-world incident, they are two different rows with different
`client_event_id`s. Resolution rule: `source = REFEREE` is authoritative by default;
`source = ADMIN_CORRECTION` always supersedes it explicitly (never silently) via the
`superseded_by_event_id` link, so both are visible in the audit trail and a human made the call.

## 6. Media: Cloudinary end-to-end (replaces Supabase Storage everywhere in the original brief)

### Why Cloudinary here
- On-the-fly transformations (avatar face-crop, thumbnail generation, `f_auto,q_auto` delivery)
  without any server-side image processing — keeps Render idle for this entirely.
- First-class video handling for match highlights (§74–75), which Supabase Storage does not
  specialize in.
- A single CDN in front of every image/video the platform serves.

### Folder convention

```text
football-platform/{env}/avatars/{userId}/{mediaId}
football-platform/{env}/teams/{teamId}/logo
football-platform/{env}/events/{eventId}/banner
football-platform/{env}/events/{eventId}/logo
football-platform/{env}/matches/{matchId}/media/{mediaId}
football-platform/{env}/certificates/{userId}/{mediaId}
```

### Upload flow (mirrors doc 04's `uploadImage`)

```text
1. Browser compresses the image client-side (browser-image-compression) before anything
   leaves the device — protects the referee's mobile data and Cloudinary quota alike.
2. Browser calls FastAPI:  POST /media/signature  { ownerType, ownerId }
      FastAPI:
        - looks up the correct folder template for ownerType
        - signs {timestamp, folder, tags} with the Cloudinary API secret
        - returns {timestamp, signature, api_key, cloud_name, folder, tags}
      (This is the ONLY place the API secret is ever used — it never reaches the browser.)
3. Browser POSTs the file + those signed params directly to
   https://api.cloudinary.com/v1_1/{cloud_name}/image/upload
4. Cloudinary returns {public_id, secure_url, width, height, format, bytes}
5. Browser inserts one row into media_assets via Supabase (RLS checks the caller
   actually owns ownerId — e.g. is the captain of teamId for a TEAM_LOGO upload)
6. The relevant parent row (users.avatar_media_id, teams.logo_media_id,
   events.banner_media_id) is updated to point at the new media_assets.id
```

Video highlights follow the identical flow with `resource_type=video` and an eager
transformation (e.g. a generated thumbnail frame) requested at signature time.

### Deletion — always server-side

```text
DELETE /media/{id}  (FastAPI)
   - checks the caller is the owner or an event/platform admin
   - calls cloudinary.uploader.destroy(public_id, resource_type)
   - deletes the media_assets row
   - if the row was referenced by users.avatar_media_id etc., nulls that reference
```

The browser is never trusted to call Cloudinary's destroy API directly (that would require
shipping the API secret client-side).

### Rendering

`components/shared/Avatar.tsx` and every other image component construct display URLs by
appending Cloudinary transformation strings to `secure_url`'s base (e.g.
`.../upload/c_thumb,g_face,w_128,h_128,f_auto,q_auto/...`) rather than storing pre-rendered
sizes — one stored asset, many delivered variants, all cached at Cloudinary's CDN edge.

### Moderation (optional, later)

Cloudinary's add-on image/video moderation can be attached at upload time via an
`eager`/`moderation` param in the signature if user-generated match photos become a problem;
this is additive and doesn't change the flow above.
