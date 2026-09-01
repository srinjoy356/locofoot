-- Update is_user_visible to allow visibility of Referees and Event Admins,
-- as their names need to be visible on public Match Centers and Event Dashboards.

CREATE OR REPLACE FUNCTION public.is_user_visible(target_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- A user can always see themselves
  IF target_user_id = auth.uid() THEN 
    RETURN true; 
  END IF;
  
  -- Service role bypass
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN true;
  END IF;
  
  -- Check if they are friends or have a pending request
  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (requester_id = auth.uid() AND addressee_id = target_user_id)
       OR (addressee_id = auth.uid() AND requester_id = target_user_id)
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if they share a conversation
  IF EXISTS (
    SELECT 1 FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    WHERE cm1.user_id = auth.uid() AND cm2.user_id = target_user_id
  ) THEN
    RETURN true;
  END IF;

  -- NEW: Public figures (Event Admins/Owners and Event Referees) are visible
  IF EXISTS (
    SELECT 1 FROM public.event_roles
    WHERE user_id = target_user_id AND role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'REFEREE')
  ) THEN
    RETURN true;
  END IF;

  -- NEW: Match Referees are visible
  IF EXISTS (
    SELECT 1 FROM public.match_referees
    WHERE user_id = target_user_id
  ) THEN
    RETURN true;
  END IF;

  -- NEW: Team members are visible to Event Admins of events they are registered in
  IF EXISTS (
    SELECT 1 FROM public.event_team_players etp
    JOIN public.event_team_registrations etr ON etr.id = etp.registration_id
    JOIN public.event_roles er ON er.event_id = etr.event_id
    WHERE etp.user_id = target_user_id 
      AND er.user_id = auth.uid() 
      AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
