-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.slot_structure_state AS ENUM ('DRAFT', 'FINALIZED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.scheduling_state AS ENUM ('NOT_STARTED', 'LIVE', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.slot_status AS ENUM ('EMPTY', 'PARTIALLY_ASSIGNED', 'FULLY_ASSIGNED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.fixture_scheduling_status AS ENUM ('UNASSIGNED', 'ASSIGNED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.match_status AS ENUM ('SCHEDULED', 'WARMUP', 'FIRST_HALF', 'HALF_TIME', 'SECOND_HALF', 'EXTRA_TIME_FIRST_HALF', 'EXTRA_TIME_HALF_TIME', 'EXTRA_TIME_SECOND_HALF', 'PENALTIES', 'COMPLETED', 'CANCELLED', 'POSTPONED', 'ABANDONED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.match_result_type AS ENUM ('NORMAL_TIME', 'EXTRA_TIME', 'PENALTIES', 'WALKOVER', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Modify events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS slot_structure_state public.slot_structure_state NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS scheduling_state public.scheduling_state NOT NULL DEFAULT 'NOT_STARTED';

-- 3. Groups
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Update event_team_registrations
ALTER TABLE public.event_team_registrations
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

-- 4. Matches (Fixtures) - Decoupled from public schedule until assigned
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  
  -- Explicit Fixture State
  scheduling_status public.fixture_scheduling_status NOT NULL DEFAULT 'UNASSIGNED',

  home_registration_id uuid REFERENCES public.event_team_registrations(id) ON DELETE SET NULL,
  away_registration_id uuid REFERENCES public.event_team_registrations(id) ON DELETE SET NULL,
  
  -- Populated ONLY when assigned to a slot (maintains Phase 4 compatibility)
  venue_field_id uuid REFERENCES public.venue_fields(id) ON DELETE RESTRICT,
  scheduled_start timestamptz,
  
  -- Phase 4 Lifecycle (Operates orthogonally to scheduling assignment)
  status public.match_status NOT NULL DEFAULT 'SCHEDULED',
  match_started_at timestamptz,
  half_started_at timestamptz,
  paused_at timestamptz,
  resumed_at timestamptz,
  first_half_injury_seconds int NOT NULL DEFAULT 0,
  second_half_injury_seconds int NOT NULL DEFAULT 0,
  home_score int NOT NULL DEFAULT 0,
  away_score int NOT NULL DEFAULT 0,
  winner_registration_id uuid REFERENCES public.event_team_registrations(id) ON DELETE SET NULL,
  result_type public.match_result_type,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Brackets
CREATE TABLE IF NOT EXISTS public.brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  round_name text NOT NULL,
  position int NOT NULL,
  home_source jsonb NOT NULL,
  away_source jsonb NOT NULL,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS bracket_id uuid REFERENCES public.brackets(id) ON DELETE SET NULL;

-- 6. Schedule Slots (Time Blocks)
CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sequence_number int NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  status public.slot_status NOT NULL DEFAULT 'EMPTY',
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_slot_sequence UNIQUE (event_id, sequence_number)
);

-- 7. Slot Field Assignments (Multi-Field Allocation)
CREATE TABLE IF NOT EXISTS public.slot_field_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_slot_id uuid NOT NULL REFERENCES public.schedule_slots(id) ON DELETE CASCADE,
  venue_field_id uuid NOT NULL REFERENCES public.venue_fields(id) ON DELETE RESTRICT,
  fixture_id uuid REFERENCES public.matches(id) ON DELETE SET NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_slot_field UNIQUE (schedule_slot_id, venue_field_id)
);

-- 8. Idempotency Keys Infrastructure
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  operation_scope text NOT NULL,
  response_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers
DROP TRIGGER IF EXISTS set_groups_updated_at ON public.groups;
CREATE TRIGGER set_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_brackets_updated_at ON public.brackets;
CREATE TRIGGER set_brackets_updated_at BEFORE UPDATE ON public.brackets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_matches_updated_at ON public.matches;
CREATE TRIGGER set_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_schedule_slots_updated_at ON public.schedule_slots;
CREATE TRIGGER set_schedule_slots_updated_at BEFORE UPDATE ON public.schedule_slots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_slot_field_assignments_updated_at ON public.slot_field_assignments;
CREATE TRIGGER set_slot_field_assignments_updated_at BEFORE UPDATE ON public.slot_field_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_field_assignments ENABLE ROW LEVEL SECURITY;

-- Public Read Policies (Strictly respecting event visibility and fixture assignment state)
DROP POLICY IF EXISTS "Public groups" ON public.groups;
CREATE POLICY "Public groups" ON public.groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status != 'DRAFT')
);

DROP POLICY IF EXISTS "Public slots" ON public.schedule_slots;
CREATE POLICY "Public slots" ON public.schedule_slots FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status != 'DRAFT' AND e.slot_structure_state = 'FINALIZED')
);

DROP POLICY IF EXISTS "Public slot fields" ON public.slot_field_assignments;
CREATE POLICY "Public slot fields" ON public.slot_field_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.schedule_slots s JOIN public.events e ON e.id = s.event_id WHERE s.id = schedule_slot_id AND e.status != 'DRAFT' AND e.slot_structure_state = 'FINALIZED')
);

DROP POLICY IF EXISTS "Public assigned matches" ON public.matches;
CREATE POLICY "Public assigned matches" ON public.matches FOR SELECT USING (
  scheduling_status = 'ASSIGNED' AND
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status != 'DRAFT')
);

DROP POLICY IF EXISTS "Public assigned brackets" ON public.brackets;
CREATE POLICY "Public assigned brackets" ON public.brackets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status != 'DRAFT')
  AND (match_id IS NULL OR EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.scheduling_status = 'ASSIGNED'))
);

-- Note: idempotency_keys is fully restricted to service role
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Revoke all mutations from public/authenticated users
REVOKE INSERT, UPDATE, DELETE ON public.groups FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.brackets FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.matches FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.schedule_slots FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.slot_field_assignments FROM authenticated, anon;
REVOKE ALL ON public.idempotency_keys FROM authenticated, anon;
