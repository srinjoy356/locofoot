-- Enums (Checked against initial_schema.sql)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_member_role') THEN
    CREATE TYPE public.team_member_role AS ENUM ('CAPTAIN', 'VICE_CAPTAIN', 'PLAYER', 'COACH_MANAGER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_member_status') THEN
    CREATE TYPE public.team_member_status AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'REMOVED', 'LEFT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_status') THEN
    CREATE TYPE public.registration_status AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'WITHDRAWN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'player_eligibility_status') THEN
    CREATE TYPE public.player_eligibility_status AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'SUSPENDED', 'REMOVED');
  END IF;
END$$;

-- Add notification types to existing enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'TEAM_INVITATION';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'TEAM_INVITATION_ACCEPTED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'TEAM_REGISTRATION_SUBMITTED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'TEAM_REGISTRATION_APPROVED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'TEAM_ROSTER_LOCKED';

-- Teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  name text NOT NULL,
  short_name text,
  logo_media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  primary_color text,
  secondary_color text,
  description text,
  instagram_url text,
  website_url text,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.team_member_role NOT NULL DEFAULT 'PLAYER',
  status public.team_member_status NOT NULL DEFAULT 'INVITED',
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_members_unique UNIQUE (team_id, user_id)
);

CREATE TABLE public.event_team_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  status public.registration_status NOT NULL DEFAULT 'DRAFT',
  seed int,
  roster_locked boolean NOT NULL DEFAULT false,
  registered_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  played int NOT NULL DEFAULT 0,
  won int NOT NULL DEFAULT 0,
  drawn int NOT NULL DEFAULT 0,
  lost int NOT NULL DEFAULT 0,
  goals_for int NOT NULL DEFAULT 0,
  goals_against int NOT NULL DEFAULT 0,
  points int NOT NULL DEFAULT 0,
  fair_play_points int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_team_registrations_unique UNIQUE (event_id, team_id)
);

CREATE TABLE public.event_team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_registration_id uuid NOT NULL REFERENCES public.event_team_registrations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  jersey_number int,
  position text,
  status public.player_eligibility_status NOT NULL DEFAULT 'PENDING_APPROVAL',
  is_captain_for_event boolean NOT NULL DEFAULT false,
  is_vice_captain_for_event boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers for updated_at
CREATE TRIGGER set_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_event_team_registrations_updated_at BEFORE UPDATE ON public.event_team_registrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_event_team_players_updated_at BEFORE UPDATE ON public.event_team_players FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: trg_team_creator_is_captain
CREATE OR REPLACE FUNCTION public.fn_team_creator_is_captain()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.created_by, 'CAPTAIN', 'ACCEPTED', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_team_creator_is_captain AFTER INSERT ON public.teams FOR EACH ROW EXECUTE FUNCTION public.fn_team_creator_is_captain();

-- Trigger: trg_enforce_single_team_per_event
CREATE OR REPLACE FUNCTION public.fn_enforce_single_team_per_event()
RETURNS TRIGGER AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF NEW.status IN ('PENDING_APPROVAL', 'APPROVED') THEN
    SELECT event_id INTO v_event_id FROM public.event_team_registrations WHERE id = NEW.event_registration_id;
    
    IF EXISTS (
      SELECT 1 FROM public.event_team_players etp
      JOIN public.event_team_registrations etr ON etp.event_registration_id = etr.id
      WHERE etr.event_id = v_event_id
        AND etp.user_id = NEW.user_id
        AND etp.id != NEW.id
        AND etp.status IN ('PENDING_APPROVAL', 'APPROVED')
    ) THEN
      RAISE EXCEPTION 'Player % is already registered for another team in this event', NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_team_per_event BEFORE INSERT OR UPDATE ON public.event_team_players FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_single_team_per_event();

-- Trigger: trg_team_invitation_notifications
CREATE OR REPLACE FUNCTION public.fn_team_invitation_notifications()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'INVITED' THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (NEW.user_id, 'TEAM_INVITATION', jsonb_build_object('team_id', NEW.team_id, 'invited_by', NEW.invited_by));
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'INVITED' AND NEW.status = 'ACCEPTED' THEN
    NEW.joined_at = NOW();
    -- Notify the captain who invited them
    IF NEW.invited_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, payload)
      VALUES (NEW.invited_by, 'TEAM_INVITATION_ACCEPTED', jsonb_build_object('team_id', NEW.team_id, 'user_id', NEW.user_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_team_invitation_notifications BEFORE INSERT OR UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.fn_team_invitation_notifications();

-- RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_team_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_team_players ENABLE ROW LEVEL SECURITY;

-- Public READ policies
CREATE POLICY "teams are publicly readable" ON public.teams FOR SELECT USING (true);
CREATE POLICY "team_members are publicly readable" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "event_team_registrations are publicly readable unless event is DRAFT" ON public.event_team_registrations FOR SELECT USING (
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
CREATE POLICY "event_team_players are publicly readable unless event is DRAFT" ON public.event_team_players FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.event_team_registrations etr 
    JOIN public.events e ON e.id = etr.event_id
    WHERE etr.id = event_registration_id AND (
      e.status != 'DRAFT' OR
      EXISTS (
        SELECT 1 FROM public.event_roles er 
        WHERE er.event_id = e.id AND er.user_id = auth.uid() AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
      )
    )
  )
);

-- Write Policies for Teams
CREATE POLICY "users can create teams" ON public.teams FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "captains can update teams" ON public.teams FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm 
    WHERE tm.team_id = id AND tm.user_id = auth.uid() AND tm.role = 'CAPTAIN' AND tm.status = 'ACCEPTED'
  )
);

CREATE POLICY "captains can invite friends" ON public.team_members FOR INSERT WITH CHECK (
  -- Caller is captain
  EXISTS (
    SELECT 1 FROM public.team_members tm 
    WHERE tm.team_id = team_id AND tm.user_id = auth.uid() AND tm.role = 'CAPTAIN' AND tm.status = 'ACCEPTED'
  )
  -- Target is friend
  AND EXISTS (
    SELECT 1 FROM public.friendships f 
    WHERE f.status = 'ACCEPTED' AND (
      (f.requester_id = auth.uid() AND f.addressee_id = user_id) OR
      (f.addressee_id = auth.uid() AND f.requester_id = user_id)
    )
  )
);

CREATE POLICY "users can accept/decline own invites, captains can remove" ON public.team_members FOR UPDATE USING (
  -- The user can update their own row (restricted by WITH CHECK)
  user_id = auth.uid()
  OR
  -- Captain can update any row
  EXISTS (
    SELECT 1 FROM public.team_members tm 
    WHERE tm.team_id = team_id AND tm.user_id = auth.uid() AND tm.role = 'CAPTAIN' AND tm.status = 'ACCEPTED'
  )
) WITH CHECK (
  -- If user is updating their own row, they can only change status
  (
    user_id = auth.uid() 
    AND team_id = team_id -- dummy true
    AND role = (SELECT role FROM public.team_members WHERE id = id)
    AND user_id = (SELECT user_id FROM public.team_members WHERE id = id)
    AND invited_by IS NOT DISTINCT FROM (SELECT invited_by FROM public.team_members WHERE id = id)
    AND status IN ('ACCEPTED', 'DECLINED', 'LEFT')
  )
  OR
  -- Captain can remove
  (
    EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = team_id AND tm.user_id = auth.uid() AND tm.role = 'CAPTAIN' AND tm.status = 'ACCEPTED'
    )
  )
);

-- Write policies for events (REVOKE from authenticated)
REVOKE INSERT, UPDATE, DELETE ON public.event_team_registrations FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.event_team_players FROM authenticated, anon;
