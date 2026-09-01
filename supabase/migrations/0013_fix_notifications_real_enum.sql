-- Fix missing SECURITY DEFINER on notifications trigger for teams (Correct enum typo)
CREATE OR REPLACE FUNCTION public.fn_team_invitation_notifications()
RETURNS TRIGGER 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'INVITED' THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (NEW.user_id, 'PLAYER_INVITED', jsonb_build_object('team_id', NEW.team_id, 'invited_by', NEW.invited_by));
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'INVITED' AND NEW.status = 'ACCEPTED' THEN
    -- Notify the captain that user accepted
    DECLARE
      v_captain_id UUID;
    BEGIN
      SELECT user_id INTO v_captain_id FROM public.team_members WHERE team_id = NEW.team_id AND role = 'CAPTAIN' AND status = 'ACCEPTED' LIMIT 1;
      IF v_captain_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, payload)
        VALUES (v_captain_id, 'PLAYER_ACCEPTED', jsonb_build_object('team_id', NEW.team_id, 'user_id', NEW.user_id));
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
