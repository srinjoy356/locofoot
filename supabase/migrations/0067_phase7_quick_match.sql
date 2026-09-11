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

-- RLS Updates
DROP POLICY IF EXISTS "events are publicly readable unless DRAFT" ON public.events;
CREATE POLICY "events are publicly readable unless DRAFT" ON public.events FOR SELECT USING (
  status != 'DRAFT' OR
  EXISTS (
    SELECT 1 FROM public.event_roles er 
    WHERE er.event_id = id AND er.user_id = auth.uid() AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
  )
);
