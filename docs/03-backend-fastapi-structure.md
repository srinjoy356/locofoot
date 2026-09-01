# 03 — Backend (FastAPI) Structure

FastAPI is the thin trust boundary described in doc 01. It holds **no** UI, does **no**
polling, and maintains **no** WebSocket connections — Supabase Realtime does that. Every
handler that mutates a trusted table writes through the Supabase **service-role** client and
appends one `audit_logs` row.

## Directory tree

```text
apps/api/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── deps.py                        # shared FastAPI dependencies (current_user, db, etc.)
│   │
│   ├── core/
│   │   ├── security.py                # Supabase JWT verification
│   │   ├── supabase_client.py         # service-role + anon clients
│   │   ├── cloudinary_client.py       # signed upload + destroy
│   │   ├── permissions.py             # role/permission matrix (§90) as code
│   │   ├── idempotency.py             # idempotency_keys + client_event_id helpers
│   │   ├── rate_limit.py              # slowapi config
│   │   ├── audit.py                   # write_audit_log() helper
│   │   └── exceptions.py              # domain exceptions → HTTP mapping
│   │
│   ├── schemas/                       # Pydantic request/response models, one file per domain
│   │   ├── users.py
│   │   ├── friends.py
│   │   ├── messages.py
│   │   ├── events.py
│   │   ├── teams.py
│   │   ├── matches.py
│   │   ├── match_events.py
│   │   ├── standings.py
│   │   ├── media.py
│   │   ├── disputes.py
│   │   └── admin.py
│   │
│   ├── routers/                       # thin HTTP layer, one file per domain — see doc 05
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── friends.py
│   │   ├── messages.py
│   │   ├── notifications.py
│   │   ├── events.py
│   │   ├── event_roles.py
│   │   ├── teams.py
│   │   ├── team_rosters.py
│   │   ├── scheduling.py
│   │   ├── matches.py
│   │   ├── match_events.py
│   │   ├── referees.py
│   │   ├── standings.py
│   │   ├── leaderboards.py
│   │   ├── disciplinary.py
│   │   ├── disputes.py
│   │   ├── reports.py
│   │   ├── media.py
│   │   └── admin.py
│   │
│   ├── services/                      # business logic, mirrors routers 1:1
│   │   ├── event_service.py
│   │   ├── team_service.py
│   │   ├── roster_service.py
│   │   ├── scheduling_service.py
│   │   ├── match_lifecycle_service.py
│   │   ├── match_event_service.py     # the goal/card/foul trust boundary — see sketch below
│   │   ├── disciplinary_service.py
│   │   ├── standings_service.py
│   │   ├── awards_service.py
│   │   ├── dispute_service.py
│   │   ├── media_service.py
│   │   └── notification_service.py
│   │
│   ├── models/                        # thin dataclasses mirroring DB rows (not an ORM layer —
│   │   └── ...                        # Supabase is queried via postgrest-py / asyncpg directly)
│   │
│   └── middleware/
│       ├── request_id.py
│       └── error_handler.py
│
├── tests/
│   ├── conftest.py
│   ├── test_match_event_service.py    # idempotency, permission matrix, state-machine guards
│   ├── test_scheduling_service.py     # round-robin math, slot overlap, rest-time constraints
│   └── test_standings_service.py      # tie-break ordering
│
├── requirements.txt
├── Dockerfile
└── render.yaml
```

## `main.py`

```python
from fastapi import FastAPI
from app.routers import (
    auth, users, friends, messages, notifications, events, event_roles,
    teams, team_rosters, scheduling, matches, match_events, referees,
    standings, leaderboards, disciplinary, disputes, reports, media, admin,
)
from app.middleware.error_handler import register_error_handlers
from app.core.rate_limit import limiter

app = FastAPI(title="Football Platform API")
app.state.limiter = limiter
register_error_handlers(app)

for r in (auth, users, friends, messages, notifications, events, event_roles,
          teams, team_rosters, scheduling, matches, match_events, referees,
          standings, leaderboards, disciplinary, disputes, reports, media, admin):
    app.include_router(r.router)
```

## `core/security.py` — verifying a Supabase JWT

```python
from jose import jwt
from fastapi import Depends, HTTPException, Header
from app.config import settings

def get_current_user(authorization: str = Header(...)) -> dict:
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"],
                              audience="authenticated")
    except jwt.JWTError:
        raise HTTPException(401, "Invalid token")
    return {"id": payload["sub"], "role": payload.get("role", "authenticated")}
```

## `core/permissions.py` — the role matrix as code (§90)

```python
from enum import Enum

class MatchAction(str, Enum):
    START_MATCH = "start_match"
    RECORD_GOAL = "record_goal"
    RECORD_CARD = "record_card"
    EDIT_EVENT = "edit_event"
    CHANGE_ROSTER = "change_roster"
    FINALIZE_MATCH = "finalize_match"

ROLE_MATCH_PERMISSIONS = {
    "REFEREE":     {MatchAction.START_MATCH, MatchAction.RECORD_GOAL,
                     MatchAction.RECORD_CARD, MatchAction.FINALIZE_MATCH},
    "SCORER":      {MatchAction.RECORD_GOAL, MatchAction.EDIT_EVENT},
    "CAPTAIN":     {MatchAction.CHANGE_ROSTER},
    "EVENT_ADMIN": {a for a in MatchAction},   # admins can do everything, with audit logging
}

def can(role: str, action: MatchAction) -> bool:
    return action in ROLE_MATCH_PERMISSIONS.get(role, set())
```

This table is deliberately **code, not a DB table** in v1 — it changes with product decisions,
not tournament configuration. (Tournament-specific *scoring* config, by contrast, lives in
`event_stat_definitions` in the DB, because that varies per event.)

## `services/match_event_service.py` — the trust-boundary sketch

```python
async def record_match_event(match_id: UUID, actor: dict, payload: RecordEventRequest) -> MatchEvent:
    match = await get_match_or_404(match_id)

    # 1. State-machine guard
    if match.status not in LIVE_STATES:
        raise DomainError("Match is not in a live state")

    # 2. Role/permission guard
    role = await get_actor_role_for_match(actor["id"], match_id)
    action = ACTION_FOR_EVENT_TYPE[payload.event_type]
    if not can(role, action):
        raise DomainError("Not permitted to record this event type")

    # 3. Player eligibility guard
    if payload.player_id:
        player = await get_event_team_player_or_404(payload.player_id)
        if player.status != "APPROVED":
            raise DomainError("Player is not eligible (suspended/removed)")
        if player.event_registration_id not in (match.home_registration_id, match.away_registration_id):
            raise DomainError("Player does not belong to a team in this match")

    # 4. Idempotency guard — client_event_id is a unique DB constraint; a duplicate insert
    #    raises a unique-violation which this function catches and treats as a no-op success
    try:
        row = await insert_match_event(match_id, actor, payload)
    except UniqueViolation:
        return await get_match_event_by_client_id(payload.client_event_id)

    # 5. Audit trail
    await write_audit_log(actor["id"], "record_match_event", "match_events", row.id,
                           old_value=None, new_value=row.dict())

    # Postgres triggers (doc 02) handle score/stat/discipline recompute and Realtime broadcast —
    # this function does not need to do it manually.
    return row
```

Every other trusted mutation (`match_lifecycle_service.start_match`,
`roster_service.lock_roster`, `standings_service.recompute`, `dispute_service.resolve`) follows
the same five-step shape: **state guard → permission guard → cross-entity guard → idempotent
write → audit log.**

## `core/cloudinary_client.py`

```python
import cloudinary, cloudinary.utils, time
from app.config import settings

cloudinary.config(cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                   api_key=settings.CLOUDINARY_API_KEY,
                   api_secret=settings.CLOUDINARY_API_SECRET)

def build_signed_upload_params(folder: str, tags: list[str]) -> dict:
    timestamp = int(time.time())
    params_to_sign = {"timestamp": timestamp, "folder": folder, "tags": ",".join(tags)}
    signature = cloudinary.utils.api_sign_request(params_to_sign, settings.CLOUDINARY_API_SECRET)
    return {**params_to_sign, "signature": signature,
            "api_key": settings.CLOUDINARY_API_KEY, "cloud_name": settings.CLOUDINARY_CLOUD_NAME}

def destroy_asset(public_id: str, resource_type: str = "image"):
    cloudinary.uploader.destroy(public_id, resource_type=resource_type)
```

Full upload lifecycle (browser → Cloudinary → `media_assets`) is diagrammed in doc 06 — the
API secret never leaves this file.

## `core/rate_limit.py`

`slowapi` limiter keyed by `user_id` (falls back to IP for unauthenticated routes). Suggested
limits: login `10/min`, friend-request `20/hour`, event-creation `5/day`, match-event writes
`120/min` (a busy match can generate a lot of events quickly — don't throttle the referee),
public read endpoints `300/min`.

## `render.yaml`

```yaml
services:
  - type: web
    name: football-platform-api
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: SUPABASE_JWT_SECRET
        sync: false
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
```
