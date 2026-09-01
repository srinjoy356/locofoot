-- Fix missing SECURITY DEFINER on notifications trigger for teams
CREATE OR REPLACE FUNCTION public.fn_team_invitation_notifications()
RETURNS TRIGGER 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'INVITED' THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (NEW.user_id, 'TEAM_INVITATION', jsonb_build_object('team_id', NEW.team_id, 'invited_by', NEW.invited_by));
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'INVITED' AND NEW.status = 'ACCEPTED' THEN
    -- Notify the captain that user accepted
    DECLARE
      v_captain_id UUID;
    BEGIN
      SELECT user_id INTO v_captain_id FROM public.team_members WHERE team_id = NEW.team_id AND role = 'CAPTAIN' AND status = 'ACCEPTED' LIMIT 1;
      IF v_captain_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, payload)
        VALUES (v_captain_id, 'TEAM_INVITATION_ACCEPTED', jsonb_build_object('team_id', NEW.team_id, 'user_id', NEW.user_id));
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Make Phase 1 triggers SECURITY DEFINER too, in case they aren't
CREATE OR REPLACE FUNCTION public.handle_friendship_notifications()
RETURNS TRIGGER 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (NEW.addressee_id, 'FRIEND_REQUEST', jsonb_build_object('requester_id', NEW.requester_id));
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'ACCEPTED' AND OLD.status = 'PENDING' THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (NEW.requester_id, 'FRIEND_ACCEPTED', jsonb_build_object('addressee_id', NEW.addressee_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_message_notifications()
RETURNS TRIGGER 
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_other_user UUID;
  v_conv_type TEXT;
BEGIN
  SELECT type INTO v_conv_type FROM public.conversations WHERE id = NEW.conversation_id;
  
  -- We only handle DM notifications automatically here
  IF v_conv_type = 'DM' THEN
    SELECT user_id INTO v_other_user FROM public.conversation_members WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id LIMIT 1;
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (v_other_user, 'NEW_MESSAGE', jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id, 'message_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
