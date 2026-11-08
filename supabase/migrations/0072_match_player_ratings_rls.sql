-- match_player_ratings had RLS disabled: anyone holding the public anon key could rewrite player ratings.
-- Ratings are only written by compute_match_ratings_and_mvp (service role), so clients get read-only access.
ALTER TABLE public.match_player_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read match_player_ratings" ON public.match_player_ratings;
CREATE POLICY "Public read match_player_ratings" ON public.match_player_ratings FOR SELECT USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.match_player_ratings FROM authenticated, anon;

-- Privilege escalation: `users_update` only checks auth.uid() = id, and `authenticated` could update EVERY column,
-- including platform_role, account_status and the *_verified flags. Limit client updates to profile fields.
-- (Role/status changes go through the service role.)
REVOKE UPDATE ON public.users FROM authenticated, anon;
GRANT UPDATE (
  display_name, username, avatar_media_id, date_of_birth, gender, phone,
  preferred_position, dominant_foot, weak_foot, bio, location_text
) ON public.users TO authenticated;
