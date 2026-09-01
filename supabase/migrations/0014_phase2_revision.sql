-- 0014_phase2_revision.sql
-- Switch from persistent teams to event-specific teams

-- 1. Drop old triggers that depend on team_members
DROP TRIGGER IF EXISTS trg_team_invitation_notifications ON public.team_members;
DROP FUNCTION IF EXISTS public.fn_team_invitation_notifications();

DROP TRIGGER IF EXISTS tr_team_invitation_notifications ON public.team_members;

DROP TRIGGER IF EXISTS trg_team_creator_is_captain ON public.teams;
DROP FUNCTION IF EXISTS public.fn_team_creator_is_captain();

DROP TRIGGER IF EXISTS set_teams_updated_at ON public.teams;
DROP TRIGGER IF EXISTS set_team_members_updated_at ON public.team_members;

-- We don't drop fn_enforce_single_team_per_event yet, we'll rewrite it below

-- 2. Modify event_team_registrations
-- We truncate to avoid data inconsistencies since we are in dev and dropping teams.
TRUNCATE TABLE public.event_team_registrations CASCADE;

ALTER TABLE public.event_team_registrations 
  DROP COLUMN IF EXISTS team_id,
  ADD COLUMN IF NOT EXISTS team_name TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS team_short_name TEXT,
  ADD COLUMN IF NOT EXISTS logo_media_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS captain_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ALTER COLUMN status SET DEFAULT 'DRAFT';

-- Constraint to ensure a team name is unique within an event (if desired, but prompt says "Do NOT require team names to be globally unique. Two different events may have teams with the same name." - a UNIQUE(event_id, team_name) is appropriate here)
ALTER TABLE public.event_team_registrations
  ADD CONSTRAINT uq_event_team_name UNIQUE (event_id, team_name);

-- 3. Modify event_team_players
TRUNCATE TABLE public.event_team_players CASCADE;
ALTER TABLE public.event_team_players
  DROP COLUMN IF EXISTS team_member_id,
  ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE;

-- 4. Recreate single-team-per-event trigger to not rely on old tables
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

-- 5. Create event_team_invitations
CREATE TABLE IF NOT EXISTS public.event_team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.event_team_registrations(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT uq_registration_invited_user UNIQUE(registration_id, invited_user_id),
  CONSTRAINT chk_no_self_invite CHECK (invited_by != invited_user_id)
);

-- Note: We rely on FastAPI for mutations so we don't need complex RLS for INSERT/UPDATE on invitations.
-- But we grant SELECT so clients can read invitations (Supabase JS)
ALTER TABLE public.event_team_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own invitations" ON public.event_team_invitations FOR SELECT USING (
  invited_user_id = auth.uid() OR invited_by = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.event_team_registrations WHERE id = registration_id AND captain_id = auth.uid())
);
-- We use the service_role key in FastAPI for writes, so no INSERT/UPDATE policies are needed.
REVOKE INSERT, UPDATE, DELETE ON public.event_team_invitations FROM authenticated, anon;

-- 6. Notification Trigger for Event Team Invitations
CREATE OR REPLACE FUNCTION public.fn_event_team_invitation_notifications()
RETURNS TRIGGER 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'PENDING' THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (NEW.invited_user_id, 'PLAYER_INVITED', jsonb_build_object('registration_id', NEW.registration_id, 'invited_by', NEW.invited_by));
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'PENDING' AND NEW.status = 'ACCEPTED' THEN
    DECLARE
      v_captain_id UUID;
    BEGIN
      SELECT captain_id INTO v_captain_id FROM public.event_team_registrations WHERE id = NEW.registration_id;
      IF v_captain_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, payload)
        VALUES (v_captain_id, 'PLAYER_ACCEPTED', jsonb_build_object('registration_id', NEW.registration_id, 'user_id', NEW.invited_user_id));
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_event_team_invitation_notifications ON public.event_team_invitations;
CREATE TRIGGER tr_event_team_invitation_notifications
AFTER INSERT OR UPDATE ON public.event_team_invitations
FOR EACH ROW EXECUTE FUNCTION public.fn_event_team_invitation_notifications();

-- 7. Atomic Acceptance RPC
CREATE OR REPLACE FUNCTION accept_event_team_invitation(p_invitation_id UUID, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_registration RECORD;
  v_event_settings RECORD;
  v_current_squad_size INT;
  v_player_id UUID;
BEGIN
  -- Row-level lock on the registration to prevent concurrent squad overflow
  SELECT * INTO v_invitation
  FROM event_team_invitations
  WHERE id = p_invitation_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF v_invitation.invited_user_id != p_user_id THEN
    RAISE EXCEPTION 'Not authorized to accept this invitation';
  END IF;

  IF v_invitation.status != 'PENDING' THEN
    RAISE EXCEPTION 'Invitation is no longer pending';
  END IF;

  SELECT * INTO v_registration
  FROM event_team_registrations
  WHERE id = v_invitation.registration_id FOR UPDATE;

  IF v_registration.status != 'DRAFT' THEN
    RAISE EXCEPTION 'Registration is no longer in draft phase';
  END IF;

  SELECT * INTO v_event_settings
  FROM event_settings
  WHERE event_id = v_registration.event_id;

  SELECT count(*) INTO v_current_squad_size
  FROM event_team_players
  WHERE event_registration_id = v_registration.id AND status IN ('PENDING_APPROVAL', 'APPROVED');

  IF v_event_settings.max_squad IS NOT NULL AND v_current_squad_size >= v_event_settings.max_squad THEN
    RAISE EXCEPTION 'Maximum squad size reached';
  END IF;

  -- Check if already playing in this event
  IF EXISTS (
    SELECT 1 FROM event_team_players etp
    JOIN event_team_registrations etr ON etp.event_registration_id = etr.id
    WHERE etr.event_id = v_registration.event_id AND etp.user_id = p_user_id AND etp.status IN ('PENDING_APPROVAL', 'APPROVED')
  ) THEN
    RAISE EXCEPTION 'User is already registered for another team in this event';
  END IF;

  -- Mark accepted
  UPDATE event_team_invitations
  SET status = 'ACCEPTED', responded_at = NOW()
  WHERE id = p_invitation_id;

  -- Insert player (status APPROVED by default unless the rule dictates otherwise, let's use APPROVED since captain approved them implicitly by inviting)
  INSERT INTO event_team_players (event_registration_id, user_id, status)
  VALUES (v_registration.id, p_user_id, 'APPROVED')
  RETURNING id INTO v_player_id;

  RETURN v_player_id;
END;
$$;

-- 8. Final Cleanup
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
