-- 0029_phase6_referee_management.sql

-- 1. Notification trigger for Match Referees
CREATE OR REPLACE FUNCTION public.fn_match_referee_notifications()
RETURNS TRIGGER 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'ASSIGNED' THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      NEW.user_id, 
      'REFEREE_ASSIGNED', 
      jsonb_build_object(
        'match_id', NEW.match_id, 
        'assigned_by', NEW.assigned_by
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'ASSIGNED' AND NEW.status = 'ACCEPTED' THEN
    IF NEW.assigned_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, payload)
      VALUES (
        NEW.assigned_by, 
        'REFEREE_ACCEPTED', 
        jsonb_build_object(
          'match_id', NEW.match_id, 
          'user_id', NEW.user_id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS match_referee_notifications ON public.match_referees;
CREATE TRIGGER match_referee_notifications
  AFTER INSERT OR UPDATE ON public.match_referees
  FOR EACH ROW EXECUTE FUNCTION public.fn_match_referee_notifications();


-- 2. RPC to invite Match Referee by Unique Code
CREATE OR REPLACE FUNCTION public.invite_match_referee(p_match_id UUID, p_unique_code TEXT)
RETURNS void
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event_id UUID;
  v_caller_role TEXT;
BEGIN
  -- Find user
  SELECT id INTO v_user_id FROM public.users WHERE unique_code = p_unique_code;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with code % not found', p_unique_code;
  END IF;

  -- Find event_id for the match
  SELECT event_id INTO v_event_id FROM public.matches WHERE id = p_match_id;
  
  -- Check if caller is event admin or owner
  SELECT role INTO v_caller_role FROM public.event_roles 
  WHERE event_id = v_event_id AND user_id = auth.uid() AND role IN ('EVENT_OWNER', 'EVENT_ADMIN');
  
  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Insert (will trigger notification)
  INSERT INTO public.match_referees (match_id, user_id, status, assigned_by)
  VALUES (p_match_id, v_user_id, 'ASSIGNED', auth.uid())
  ON CONFLICT (match_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;


-- 3. RPC to invite Event Referee by Unique Code
CREATE OR REPLACE FUNCTION public.invite_event_referee(p_event_id UUID, p_unique_code TEXT)
RETURNS void
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_caller_role TEXT;
BEGIN
  -- Find user
  SELECT id INTO v_user_id FROM public.users WHERE unique_code = p_unique_code;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with code % not found', p_unique_code;
  END IF;

  -- Check if caller is event admin or owner
  SELECT role INTO v_caller_role FROM public.event_roles 
  WHERE event_id = p_event_id AND user_id = auth.uid() AND role IN ('EVENT_OWNER', 'EVENT_ADMIN');
  
  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Insert role
  INSERT INTO public.event_roles (event_id, user_id, role, granted_by)
  VALUES (p_event_id, v_user_id, 'REFEREE', auth.uid())
  ON CONFLICT (event_id, user_id, role) DO UPDATE SET role = 'REFEREE';
END;
$$ LANGUAGE plpgsql;
