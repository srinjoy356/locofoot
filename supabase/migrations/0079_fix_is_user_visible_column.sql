-- 0033 joined event_team_players on a column that does not exist (registration_id; the column is event_registration_id).
-- Any profile that was not the caller, a friend, a chat partner, a referee or an event owner/admin made the whole query
-- fail with "column etp.registration_id does not exist", e.g. an organizer listing their own scorers.
-- Scorers and managers are officials too, so they are public alongside referees.
CREATE OR REPLACE FUNCTION public.is_user_visible(target_user_id uuid)
RETURNS boolean AS $$
BEGIN
  IF target_user_id = auth.uid() THEN
    RETURN true;
  END IF;

  IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (requester_id = auth.uid() AND addressee_id = target_user_id)
       OR (addressee_id = auth.uid() AND requester_id = target_user_id)
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    WHERE cm1.user_id = auth.uid() AND cm2.user_id = target_user_id
  ) THEN
    RETURN true;
  END IF;

  -- Officials are public: their names appear on match centres and event dashboards
  IF EXISTS (
    SELECT 1 FROM public.event_roles
    WHERE user_id = target_user_id AND role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER', 'REFEREE', 'SCORER')
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM public.match_referees WHERE user_id = target_user_id) THEN
    RETURN true;
  END IF;

  -- Team members are visible to everyone running the event they play in: the recorder and the referee need their names
  IF EXISTS (
    SELECT 1 FROM public.event_team_players etp
    JOIN public.event_team_registrations etr ON etr.id = etp.event_registration_id
    JOIN public.event_roles er ON er.event_id = etr.event_id
    WHERE etp.user_id = target_user_id
      AND er.user_id = auth.uid()
      AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER', 'REFEREE', 'SCORER')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
