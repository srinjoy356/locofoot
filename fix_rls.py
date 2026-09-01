import httpx, os, json
env = dict([line.strip().split('=',1) for line in open('.env').readlines() if '=' in line and not line.startswith('#')])
sql = """
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
  -- BUGFIX: etp.registration_id was incorrect, it should be etp.event_registration_id
  IF EXISTS (
    SELECT 1 FROM public.event_team_players etp
    JOIN public.event_team_registrations etr ON etr.id = etp.event_registration_id
    JOIN public.event_roles er ON er.event_id = etr.event_id
    WHERE etp.user_id = target_user_id 
      AND er.user_id = auth.uid() 
      AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN')
  ) THEN
    RETURN true;
  END IF;

  -- NEW: Team members are visible to Match Referees of matches they play in
  IF EXISTS (
    SELECT 1 FROM public.event_team_players etp
    JOIN public.matches m ON (m.home_registration_id = etp.event_registration_id OR m.away_registration_id = etp.event_registration_id)
    JOIN public.match_referees mr ON mr.match_id = m.id
    WHERE etp.user_id = target_user_id 
      AND mr.user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- NEW: Team members are visible to anyone who can view the match
  -- For now we assume matches are public, so players registered to them are public!
  -- Actually, let's just make players on a registered team visible to anyone
  IF EXISTS (
    SELECT 1 FROM public.event_team_players etp
    WHERE etp.user_id = target_user_id
      AND etp.status = 'APPROVED'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
"""
resp = httpx.post('https://api.supabase.com/v1/projects/lcxgjwdffkexrrnfcuik/database/query', headers={'Authorization': 'Bearer '+env['SUPABASE_ACCESS_TOKEN']}, json={'query': sql})
print(resp.status_code)
print(resp.text)
