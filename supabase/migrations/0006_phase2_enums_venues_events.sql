-- Enum Definitions (Checked against initial_schema.sql)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE public.event_status AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'SCHEDULING', 'SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_role') THEN
    CREATE TYPE public.event_role AS ENUM ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER', 'REFEREE', 'SCORER', 'VOLUNTEER', 'VIEWER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_format') THEN
    CREATE TYPE public.tournament_format AS ENUM ('ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN', 'KNOCKOUT', 'GROUP_KNOCKOUT', 'SWISS', 'CUSTOM');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stat_category') THEN
    CREATE TYPE public.stat_category AS ENUM ('OFFENSIVE', 'DEFENSIVE', 'GOALKEEPER', 'DISCIPLINE', 'MISC');
  END IF;
END$$;

-- Venues
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  latitude numeric,
  longitude numeric,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.venue_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  surface_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text UNIQUE,
  slug text UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  logo_media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  banner_media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  organizer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  venue_id uuid REFERENCES public.venues(id) ON DELETE RESTRICT,
  start_date timestamptz,
  end_date timestamptz,
  registration_deadline timestamptz,
  status public.event_status NOT NULL DEFAULT 'DRAFT',
  public_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.event_settings (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  players_on_field int NOT NULL DEFAULT 11,
  substitutes_allowed int NOT NULL DEFAULT 5,
  min_squad int NOT NULL DEFAULT 11,
  max_squad int NOT NULL DEFAULT 18,
  first_half_minutes int NOT NULL DEFAULT 45,
  second_half_minutes int NOT NULL DEFAULT 45,
  half_time_minutes int NOT NULL DEFAULT 15,
  extra_time_allowed boolean NOT NULL DEFAULT false,
  extra_time_minutes int,
  penalty_shootout_allowed boolean NOT NULL DEFAULT false,
  max_substitutions int NOT NULL DEFAULT 5,
  rolling_subs boolean NOT NULL DEFAULT false,
  injury_time_tracking boolean NOT NULL DEFAULT true,
  buffer_minutes int NOT NULL DEFAULT 15,
  min_rest_minutes int NOT NULL DEFAULT 60,
  points_win int NOT NULL DEFAULT 3,
  points_draw int NOT NULL DEFAULT 1,
  points_loss int NOT NULL DEFAULT 0,
  fair_play_affects_ranking boolean NOT NULL DEFAULT false,
  fair_play_as_tiebreak boolean NOT NULL DEFAULT false,
  tie_break_order jsonb NOT NULL DEFAULT '["POINTS","GOAL_DIFFERENCE","GOALS_SCORED","HEAD_TO_HEAD","FAIR_PLAY"]'::jsonb,
  tournament_format public.tournament_format NOT NULL DEFAULT 'ROUND_ROBIN',
  allow_duplicate_jersey_numbers boolean NOT NULL DEFAULT false
);

CREATE TABLE public.event_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.event_role NOT NULL,
  granted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_roles_unique UNIQUE (event_id, user_id, role)
);

CREATE TABLE public.event_stat_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stat_key text NOT NULL,
  label text NOT NULL,
  category public.stat_category NOT NULL,
  points_value numeric NOT NULL DEFAULT 0,
  affects_fair_play boolean NOT NULL DEFAULT false,
  fair_play_delta numeric NOT NULL DEFAULT 0,
  CONSTRAINT event_stat_definitions_unique UNIQUE (event_id, stat_key)
);

CREATE TABLE public.event_disciplinary_rules (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  second_yellow_triggers_red boolean NOT NULL DEFAULT true,
  red_suspension_matches int NOT NULL DEFAULT 1,
  accumulated_yellow_threshold int NOT NULL DEFAULT 2,
  accumulated_yellow_suspension_matches int NOT NULL DEFAULT 1
);

-- Triggers for updated_at
CREATE TRIGGER set_venues_updated_at BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_venue_fields_updated_at BEFORE UPDATE ON public.venue_fields FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_stat_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_disciplinary_rules ENABLE ROW LEVEL SECURITY;

-- Public READ policies (hiding DRAFT events unless owner/admin)
CREATE POLICY "venues are publicly readable" ON public.venues FOR SELECT USING (true);
CREATE POLICY "venue_fields are publicly readable" ON public.venue_fields FOR SELECT USING (true);

CREATE POLICY "events are publicly readable unless DRAFT" ON public.events FOR SELECT USING (
  status != 'DRAFT' OR
  EXISTS (
    SELECT 1 FROM public.event_roles er 
    WHERE er.event_id = id AND er.user_id = auth.uid() AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
  )
);

CREATE POLICY "event_settings are publicly readable unless DRAFT" ON public.event_settings FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = event_id AND (
      e.status != 'DRAFT' OR
      EXISTS (
        SELECT 1 FROM public.event_roles er 
        WHERE er.event_id = e.id AND er.user_id = auth.uid() AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
      )
    )
  )
);

CREATE POLICY "event_roles are publicly readable" ON public.event_roles FOR SELECT USING (true);

CREATE POLICY "event_stat_definitions are publicly readable" ON public.event_stat_definitions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status != 'DRAFT'
  ) OR
  EXISTS (
    SELECT 1 FROM public.event_roles er WHERE er.event_id = event_stat_definitions.event_id AND er.user_id = auth.uid() AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN')
  )
);

CREATE POLICY "event_disciplinary_rules are publicly readable" ON public.event_disciplinary_rules FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status != 'DRAFT'
  ) OR
  EXISTS (
    SELECT 1 FROM public.event_roles er WHERE er.event_id = event_disciplinary_rules.event_id AND er.user_id = auth.uid() AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN')
  )
);

-- Write policies (REVOKE from authenticated)
REVOKE INSERT, UPDATE, DELETE ON public.venues FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.venue_fields FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.events FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.event_settings FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.event_roles FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.event_stat_definitions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.event_disciplinary_rules FROM authenticated, anon;
