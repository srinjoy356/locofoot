-- 1. Create a secure visibility function for users
CREATE OR REPLACE FUNCTION public.is_user_visible(target_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- A user can always see themselves
  IF target_user_id = auth.uid() THEN 
    RETURN true; 
  END IF;
  
  -- Service role bypass (if needed for some reason, though RLS usually bypasses anyway for service role)
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

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Update users_select policy
DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users FOR SELECT
  USING (public.is_user_visible(id));

-- 3. Create RPC for searching by exact unique_code (since users are now hidden)
CREATE OR REPLACE FUNCTION public.search_user_by_unique_code(search_code text)
RETURNS TABLE (
  id uuid,
  unique_code text,
  username text,
  display_name text,
  avatar_media_id uuid
) AS $$
BEGIN
  RETURN QUERY SELECT u.id, u.unique_code, u.username, u.display_name, u.avatar_media_id
  FROM public.users u
  WHERE u.unique_code = search_code
  -- Don't allow searching yourself
  AND u.id != auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
