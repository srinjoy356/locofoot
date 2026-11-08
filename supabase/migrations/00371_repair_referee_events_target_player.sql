-- Schema drift repair: 0038/0057/0059 read referee_events.target_player_id, but no earlier migration
-- created it (the hosted DB had it added by hand). Idempotent, so safe on databases that already have it.
ALTER TABLE public.referee_events
  ADD COLUMN IF NOT EXISTS target_player_id uuid REFERENCES public.event_team_players(id) ON DELETE SET NULL;

-- match_participation.status / participation_status were created by hand on the hosted DB.
DO $$ BEGIN
  CREATE TYPE public.participation_status AS ENUM ('STARTER', 'SUBSTITUTE', 'SUBBED_IN', 'SUBBED_OUT', 'SENT_OFF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.match_participation ADD COLUMN IF NOT EXISTS status public.participation_status;

-- match_lineups / match_lineup_players were only ever created by hand on the hosted DB.
CREATE TABLE IF NOT EXISTS public.match_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_registration_id uuid NOT NULL REFERENCES public.event_team_registrations(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'MODIFIED', 'RESUBMITTED', 'CHANGES_REQUESTED', 'CONFIRMED')),
  submitted_by uuid REFERENCES auth.users(id),
  submitted_at timestamptz,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, team_registration_id)
);

CREATE TABLE IF NOT EXISTS public.match_lineup_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineup_id uuid NOT NULL REFERENCES public.match_lineups(id) ON DELETE CASCADE,
  event_team_player_id uuid NOT NULL REFERENCES public.event_team_players(id) ON DELETE CASCADE,
  lineup_role text NOT NULL CHECK (lineup_role IN ('STARTER', 'SUBSTITUTE')),
  UNIQUE (lineup_id, event_team_player_id)
);

ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_lineup_players ENABLE ROW LEVEL SECURITY;

-- Readable wherever the match itself is readable; all writes go through the FastAPI service role.
DROP POLICY IF EXISTS "Read lineups of visible matches" ON public.match_lineups;
CREATE POLICY "Read lineups of visible matches" ON public.match_lineups FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id));
DROP POLICY IF EXISTS "Read lineup players of visible matches" ON public.match_lineup_players;
CREATE POLICY "Read lineup players of visible matches" ON public.match_lineup_players FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.match_lineups l WHERE l.id = lineup_id));
REVOKE INSERT, UPDATE, DELETE ON public.match_lineups FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.match_lineup_players FROM authenticated, anon;
GRANT SELECT ON public.match_lineups, public.match_lineup_players TO authenticated, anon;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.match_lineups;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- match_timeline_events columns written by MatchEngineService.record_timeline_event, never migrated.
ALTER TABLE public.match_timeline_events
  ADD COLUMN IF NOT EXISTS is_big_chance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS related_event_id uuid REFERENCES public.match_timeline_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assist_player_id uuid REFERENCES public.event_team_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assist_event_id uuid REFERENCES public.match_timeline_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS second_assist_player_id uuid REFERENCES public.event_team_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS second_assist_event_id uuid REFERENCES public.match_timeline_events(id) ON DELETE SET NULL;
