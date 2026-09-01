-- 0017_fix_invitation_notifications.sql
-- Fix the trigger to fire on UPDATE when a cancelled invitation is revived, and include event_id/invitation_id in the payload

CREATE OR REPLACE FUNCTION public.fn_event_team_invitation_notifications()
RETURNS TRIGGER 
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_captain_id UUID;
  v_event_id UUID;
BEGIN
  -- When a new invitation is created, or a cancelled one is revived to PENDING
  IF (TG_OP = 'INSERT' AND NEW.status = 'PENDING') OR (TG_OP = 'UPDATE' AND OLD.status != 'PENDING' AND NEW.status = 'PENDING') THEN
    
    -- Fetch event_id to include in the payload
    SELECT event_id INTO v_event_id FROM public.event_team_registrations WHERE id = NEW.registration_id;

    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      NEW.invited_user_id, 
      'PLAYER_INVITED', 
      jsonb_build_object(
        'registration_id', NEW.registration_id, 
        'invited_by', NEW.invited_by,
        'event_id', v_event_id,
        'invitation_id', NEW.id
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'PENDING' AND NEW.status = 'ACCEPTED' THEN
    SELECT captain_id INTO v_captain_id FROM public.event_team_registrations WHERE id = NEW.registration_id;
    IF v_captain_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, payload)
      VALUES (v_captain_id, 'PLAYER_ACCEPTED', jsonb_build_object('registration_id', NEW.registration_id, 'user_id', NEW.invited_user_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
