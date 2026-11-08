-- Assigning a referee used to check nothing but the caller's role: anyone with a code could be put on a match, and one
-- referee could be given two matches at the same time. Both are refused now.
CREATE OR REPLACE FUNCTION public.invite_match_referee(p_match_id UUID, p_unique_code TEXT)
RETURNS void
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event_id UUID;
  v_start timestamptz;
  v_minutes int;
  v_caller_role TEXT;
  v_clash RECORD;
BEGIN
  SELECT event_id, scheduled_start INTO v_event_id, v_start FROM public.matches WHERE id = p_match_id;
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  SELECT role INTO v_caller_role FROM public.event_roles
  WHERE event_id = v_event_id AND user_id = auth.uid() AND role IN ('EVENT_OWNER', 'EVENT_ADMIN');
  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Empty code clears the match's referee
  IF p_unique_code = '' OR p_unique_code IS NULL THEN
    DELETE FROM public.match_referees WHERE match_id = p_match_id;
    RETURN;
  END IF;

  SELECT id INTO v_user_id FROM public.users WHERE unique_code = p_unique_code;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with code % not found', p_unique_code;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_roles
    WHERE event_id = v_event_id AND user_id = v_user_id AND role IN ('REFEREE', 'EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
  ) THEN
    RAISE EXCEPTION 'That user is not a referee for this tournament. Grant the referee role first.';
  END IF;

  -- one referee cannot officiate two matches that overlap in time
  IF v_start IS NOT NULL THEN
    SELECT COALESCE(first_half_minutes, 45) + COALESCE(half_time_minutes, 15) + COALESCE(second_half_minutes, 45)
      INTO v_minutes FROM public.event_settings WHERE event_id = v_event_id;
    SELECT m.id, m.scheduled_start INTO v_clash
    FROM public.match_referees mr
    JOIN public.matches m ON m.id = mr.match_id
    WHERE mr.user_id = v_user_id AND m.event_id = v_event_id AND m.id <> p_match_id
      AND m.scheduled_start IS NOT NULL
      AND abs(extract(epoch FROM (m.scheduled_start - v_start))) / 60 < COALESCE(v_minutes, 90)
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'That referee is already officiating another match at the same time. Pick someone else.';
    END IF;
  END IF;

  -- 1 match = 1 referee: clear the previous one to allow swapping
  DELETE FROM public.match_referees WHERE match_id = p_match_id;

  INSERT INTO public.match_referees (match_id, user_id, status, assigned_by)
  VALUES (p_match_id, v_user_id, 'ASSIGNED', auth.uid())
  ON CONFLICT (match_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
