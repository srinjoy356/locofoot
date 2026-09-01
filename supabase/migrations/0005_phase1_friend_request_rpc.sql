CREATE OR REPLACE FUNCTION public.send_friend_request(target_user_id uuid)
RETURNS uuid AS $$
DECLARE
  existing_id uuid;
  current_status public.friendship_status;
  block_exists boolean;
BEGIN
  -- Validate not self
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Check for existing blocks
  SELECT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = target_user_id AND b.blocked_id = auth.uid())
       OR (b.blocker_id = auth.uid() AND b.blocked_id = target_user_id)
  ) INTO block_exists;
  
  IF block_exists THEN
    RAISE EXCEPTION 'Cannot send friend request (blocked)';
  END IF;

  -- Check for existing friendship row
  SELECT id, status INTO existing_id, current_status
  FROM public.friendships
  WHERE (requester_id = auth.uid() AND addressee_id = target_user_id)
     OR (addressee_id = auth.uid() AND requester_id = target_user_id);

  IF existing_id IS NOT NULL THEN
    -- If it's already pending or accepted, do nothing
    IF current_status = 'PENDING' OR current_status = 'ACCEPTED' THEN
      RETURN existing_id;
    END IF;
    
    -- If blocked via friendship status (fallback), don't allow
    IF current_status = 'BLOCKED' THEN
      RAISE EXCEPTION 'Cannot send friend request (blocked)';
    END IF;

    -- Update to PENDING, making the current user the new requester
    UPDATE public.friendships
    SET status = 'PENDING',
        requester_id = auth.uid(),
        addressee_id = target_user_id
    WHERE id = existing_id;
    
    RETURN existing_id;
  ELSE
    -- Insert new row
    INSERT INTO public.friendships (requester_id, addressee_id, status)
    VALUES (auth.uid(), target_user_id, 'PENDING')
    RETURNING id INTO existing_id;
    
    RETURN existing_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
