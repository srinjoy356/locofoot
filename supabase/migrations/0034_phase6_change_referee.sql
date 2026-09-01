-- 0034_phase6_change_referee.sql

-- Update RPC to clear existing referees for a match before assigning a new one
-- This supports the "changeable" dropdown behavior where 1 match = 1 referee
CREATE OR REPLACE FUNCTION public.invite_match_referee(p_match_id UUID, p_unique_code TEXT)
RETURNS void
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event_id UUID;
  v_caller_role TEXT;
BEGIN
  -- If empty code passed, just clear the referees (un-assign)
  IF p_unique_code = '' OR p_unique_code IS NULL THEN
    DELETE FROM public.match_referees WHERE match_id = p_match_id;
    RETURN;
  END IF;

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

  -- Clear existing referees for this match to allow swapping
  DELETE FROM public.match_referees WHERE match_id = p_match_id;

  -- Insert (will trigger notification)
  INSERT INTO public.match_referees (match_id, user_id, status, assigned_by)
  VALUES (p_match_id, v_user_id, 'ASSIGNED', auth.uid())
  ON CONFLICT (match_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
