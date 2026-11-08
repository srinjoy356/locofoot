-- The match stats page calls this RPC to name every player of an event (users are hidden from non-friends by RLS, so it
-- must be SECURITY DEFINER). It was never created by a migration; without it unnamed players showed as "Unknown".
CREATE OR REPLACE FUNCTION public.get_event_player_names(p_event_id uuid)
RETURNS TABLE (player_id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT etp.id,
         COALESCE(u.display_name, u.username, etp.guest_name, 'Player')::text
  FROM public.event_team_players etp
  JOIN public.event_team_registrations etr ON etr.id = etp.event_registration_id
  JOIN public.events e ON e.id = etr.event_id
  LEFT JOIN public.users u ON u.id = etp.user_id
  WHERE etr.event_id = p_event_id
    AND e.status <> 'DRAFT';  -- same visibility rule as the public event pages
$$;

REVOKE ALL ON FUNCTION public.get_event_player_names(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_player_names(uuid) TO anon, authenticated;
