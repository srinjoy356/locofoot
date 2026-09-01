-- 0030_phase6_referee_management_fix.sql

-- Replace the faulty ON CONFLICT clause for the event_roles insertion.
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
