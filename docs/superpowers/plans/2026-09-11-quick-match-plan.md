# Quick Match Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow organizers to instantly start a 1-off match from the sidebar with fully integrated ghost players, custom rosters, and referee assignments without navigating through the tournament flow.

**Architecture:** A new POST API orchestrates the creation of a background `QUICK_MATCH` event, 2 teams, registrations, rosters (with optional `guest_name` for unregistered players), and a single fixture. A streamlined Next.js React UI drives the setup.

**Tech Stack:** FastAPI (Python), PostgreSQL (Supabase), Next.js (React), TailwindCSS.

## Global Constraints
1. The docs/ directory is the source of truth.
2. Every database migration must include RLS.
3. Every derived statistic must be recomputable.

---

### Task 1: Database Schema & Migration

**Files:**
- Create: `supabase/migrations/0067_phase7_quick_match.sql`

**Interfaces:**
- Produces: Database schema allowing `guest_name` on `event_team_players` and `event_type` on `events`.

- [ ] **Step 1: Write the migration script**

```sql
-- Enums
DO $$ BEGIN
  CREATE TYPE public.event_type AS ENUM ('TOURNAMENT', 'QUICK_MATCH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS type public.event_type NOT NULL DEFAULT 'TOURNAMENT';

-- Guest Players support
ALTER TABLE public.event_team_players ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.event_team_players ADD COLUMN IF NOT EXISTS guest_name text;

-- Constraint to ensure either user_id or guest_name exists
ALTER TABLE public.event_team_players ADD CONSTRAINT chk_player_identity CHECK (
  (user_id IS NOT NULL) OR (guest_name IS NOT NULL)
);

-- RLS Updates (Explore page visibility handled by backend/frontend filtering via type = 'TOURNAMENT')
```

- [ ] **Step 2: Run the migration**
Run: `npx supabase migration up`
Expected: Migration applies successfully.

---

### Task 2: FastAPI Schemas & Backend Models

**Files:**
- Modify: `apps/api/app/schemas/events.py`
- Modify: `apps/api/app/schemas/teams.py`

**Interfaces:**
- Produces: API schemas supporting `event_type` and `guest_name`.

- [ ] **Step 1: Update Pydantic Schemas**

```python
# apps/api/app/schemas/events.py
from enum import Enum

class EventType(str, Enum):
    TOURNAMENT = 'TOURNAMENT'
    QUICK_MATCH = 'QUICK_MATCH'

# Add to EventCreate, EventResponse:
# type: EventType = EventType.TOURNAMENT
```

```python
# apps/api/app/schemas/teams.py
# In EventTeamPlayerCreate:
# user_id: Optional[UUID4] = None
# guest_name: Optional[str] = None
```

- [ ] **Step 2: Verify FastAPI starts**
Run: `npm run dev:api` (or python server run command)
Expected: No pydantic startup errors.

---

### Task 3: Quick Match Orchestration API

**Files:**
- Create: `apps/api/app/schemas/quick_match.py`
- Create: `apps/api/app/api/v1/endpoints/quick_match.py`
- Modify: `apps/api/app/api/v1/api.py`

**Interfaces:**
- Consumes: Task 2 schemas
- Produces: `POST /api/v1/quick-match` endpoint returning `{ "match_id": "uuid" }`

- [ ] **Step 1: Write QuickMatchCreate Schema**

```python
# apps/api/app/schemas/quick_match.py
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

class QuickMatchPlayer(BaseModel):
    user_id: Optional[UUID] = None
    guest_name: Optional[str] = None
    jersey_number: Optional[int] = None

class QuickMatchTeam(BaseModel):
    name: str
    players: List[QuickMatchPlayer]

class QuickMatchCreate(BaseModel):
    match_name: Optional[str] = "Quick Match"
    referee_id: Optional[UUID] = None
    scorer_id: Optional[UUID] = None
    team_a: QuickMatchTeam
    team_b: QuickMatchTeam
```

- [ ] **Step 2: Write Orchestration Logic**
Implement transaction in `quick_match.py` that inserts `events`, `event_roles`, `teams`, `event_team_registrations`, `event_team_players`, and `matches` sequentially using raw SQL or Supabase Service Role client.

- [ ] **Step 3: Register Router**
Add router to `apps/api/app/api/v1/api.py`.

---

### Task 4: Frontend UI (Sidebar & Quick Match Form)

**Files:**
- Modify: `apps/web/src/components/shared/Navigation.tsx`
- Create: `apps/web/src/app/(main)/admin/quick-match/page.tsx`
- Create: `apps/web/src/components/quick-match/QuickMatchForm.tsx`

**Interfaces:**
- Consumes: Task 3 API endpoint.

- [ ] **Step 1: Update Sidebar Navigation**
Add Quick Match button to sidebar primary links.

- [ ] **Step 2: Implement QuickMatchForm**
Create a form with two columns for Team A and Team B.
Implement a generic "User Search or Ghost Name" combo input. When the user types a string not found in the DB, it stores as a `guest_name`.
Add inputs for assigning Referee and Scorer.

- [ ] **Step 3: Wire API Submission**
On submit, POST to `/api/v1/quick-match` and redirect the user to `/matches/[match_id]/control`.

- [ ] **Step 4: Update Explore Page Filter**
Modify `apps/web/src/app/(public)/explore/page.tsx` query for events to append `.eq("type", "TOURNAMENT")` so quick matches don't spam the public tournament feed.
