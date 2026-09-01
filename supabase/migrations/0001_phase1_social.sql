-- 0001_phase1_social.sql

-- 1. ENUMS (Safe creation)
DO $$ BEGIN
  CREATE TYPE public.friendship_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'TEAM_REGISTRATION_APPROVED', 'PLAYER_INVITED', 'PLAYER_ACCEPTED', 
    'ROSTER_INCOMPLETE', 'MATCH_SCHEDULED', 'MATCH_CHANGED', 
    'MATCH_STARTING_SOON', 'REFEREE_ASSIGNED', 'REFEREE_ACCEPTED', 
    'MATCH_STARTED', 'MATCH_ENDED', 'TOURNAMENT_COMPLETED', 
    'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'DM_RECEIVED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. TABLES

-- Friendships
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX friendships_pair_unique_idx ON public.friendships (
  LEAST(requester_id, addressee_id),
  GREATEST(requester_id, addressee_id)
);

CREATE TRIGGER set_friendships_updated_at
BEFORE UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Blocks
CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT blocks_pair_unique UNIQUE (blocker_id, blocked_id)
);

-- Conversations
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Conversation Members
CREATE TABLE public.conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT NOW(),
  last_read_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz
);

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read_at, created_at DESC);

-- 3. RLS POLICIES

-- friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships_select"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "friendships_insert"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = requester_id AND 
    auth.uid() != addressee_id AND
    NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = addressee_id AND b.blocked_id = auth.uid())
         OR (b.blocker_id = auth.uid() AND b.blocked_id = addressee_id)
    )
  );

CREATE POLICY "friendships_update"
  ON public.friendships FOR UPDATE
  TO authenticated
  USING (
    -- Only allow updates if user is part of the friendship
    (auth.uid() = requester_id OR auth.uid() = addressee_id)
  )
  WITH CHECK (
    (auth.uid() = requester_id OR auth.uid() = addressee_id)
  );
  -- (More granular validation of status transitions is possible, but we rely on RLS logic here combined with client usage. 
  -- e.g. Addressee can accept/reject. Requester can cancel.)

-- blocks
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_select"
  ON public.blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY "blocks_insert"
  ON public.blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id AND auth.uid() != blocked_id);

CREATE POLICY "blocks_delete"
  ON public.blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);


-- SECURITY DEFINER Function for RLS to prevent recursion
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_select"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(id));
REVOKE INSERT, UPDATE, DELETE ON public.conversations FROM authenticated, anon;


-- conversation_members
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversation_members_select"
  ON public.conversation_members FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(conversation_id));

-- Only allow users to update their own last_read_at
CREATE POLICY "conversation_members_update"
  ON public.conversation_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE INSERT, DELETE ON public.conversation_members FROM authenticated, anon;


-- messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select"
  ON public.messages FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(conversation_id));

CREATE POLICY "messages_insert"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    public.is_conversation_member(conversation_id) AND
    NOT EXISTS (
      -- Block check: In a 1-to-1 conversation, neither user can block the other to send a message
      SELECT 1 
      FROM public.conversations c
      JOIN public.conversation_members cm_other ON cm_other.conversation_id = c.id
      JOIN public.blocks b ON 
        (b.blocker_id = auth.uid() AND b.blocked_id = cm_other.user_id) OR
        (b.blocker_id = cm_other.user_id AND b.blocked_id = auth.uid())
      WHERE c.id = messages.conversation_id
        AND c.is_group = false
        AND cm_other.user_id != auth.uid()
    )
  );
REVOKE UPDATE, DELETE ON public.messages FROM authenticated, anon;


-- notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
REVOKE INSERT, DELETE ON public.notifications FROM authenticated, anon;


-- 4. FUNCTIONS & TRIGGERS

-- Trigger: Cascade blocks to friendships
CREATE OR REPLACE FUNCTION public.cascade_block_to_friendship()
RETURNS trigger AS $$
BEGIN
  UPDATE public.friendships
  SET status = 'BLOCKED', updated_at = NOW()
  WHERE (requester_id = NEW.blocker_id AND addressee_id = NEW.blocked_id)
     OR (requester_id = NEW.blocked_id AND addressee_id = NEW.blocker_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_block_inserted
  AFTER INSERT ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.cascade_block_to_friendship();


-- Trigger: Enforce max two members in 1-to-1 conversations
CREATE OR REPLACE FUNCTION public.enforce_max_two_members()
RETURNS trigger AS $$
DECLARE
  is_group_chat boolean;
  member_count integer;
BEGIN
  SELECT is_group INTO is_group_chat FROM public.conversations WHERE id = NEW.conversation_id;
  IF is_group_chat = false THEN
    SELECT count(*) INTO member_count FROM public.conversation_members WHERE conversation_id = NEW.conversation_id;
    IF member_count >= 2 THEN
      RAISE EXCEPTION 'A direct conversation can only have two members.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_max_members
  BEFORE INSERT ON public.conversation_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_two_members();


-- RPC: get_or_create_direct_conversation
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(target_user_id uuid)
RETURNS uuid AS $$
DECLARE
  caller_id uuid;
  conv_id uuid;
  target_permission public.dm_permission;
  is_friend boolean;
  is_blocked boolean;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot create a conversation with yourself';
  END IF;

  -- 1. Check if conversation already exists
  SELECT c.id INTO conv_id
  FROM public.conversations c
  JOIN public.conversation_members cm1 ON c.id = cm1.conversation_id
  JOIN public.conversation_members cm2 ON c.id = cm2.conversation_id
  WHERE c.is_group = false 
    AND cm1.user_id = caller_id 
    AND cm2.user_id = target_user_id
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  -- 2. Validate block
  SELECT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = caller_id AND b.blocked_id = target_user_id)
       OR (b.blocker_id = target_user_id AND b.blocked_id = caller_id)
  ) INTO is_blocked;

  IF is_blocked THEN
    RAISE EXCEPTION 'Communication blocked between users';
  END IF;

  -- 3. Validate dm_permission and friendship
  SELECT dm_permission INTO target_permission FROM public.user_privacy_settings WHERE user_id = target_user_id;
  IF target_permission = 'NONE' THEN
    RAISE EXCEPTION 'Target user does not accept direct messages';
  END IF;

  IF target_permission = 'FRIENDS' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'ACCEPTED' 
        AND ((f.requester_id = caller_id AND f.addressee_id = target_user_id)
          OR (f.requester_id = target_user_id AND f.addressee_id = caller_id))
    ) INTO is_friend;

    IF NOT is_friend THEN
      RAISE EXCEPTION 'Target user only accepts messages from friends';
    END IF;
  END IF;

  -- 4. Create conversation atomically
  INSERT INTO public.conversations (is_group) VALUES (false) RETURNING id INTO conv_id;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (conv_id, caller_id), (conv_id, target_user_id);

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger: Notifications on Friendships
CREATE OR REPLACE FUNCTION public.handle_friendship_notifications()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A request was sent
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (NEW.addressee_id, 'FRIEND_REQUEST', jsonb_build_object('requester_id', NEW.requester_id, 'friendship_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'PENDING' AND NEW.status = 'ACCEPTED' THEN
    -- Request was accepted
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (NEW.requester_id, 'FRIEND_ACCEPTED', jsonb_build_object('addressee_id', NEW.addressee_id, 'friendship_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_friendship_changed
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.handle_friendship_notifications();


-- Trigger: Notifications on Messages
CREATE OR REPLACE FUNCTION public.handle_message_notifications()
RETURNS trigger AS $$
DECLARE
  rec_user_id uuid;
BEGIN
  -- We only handle DM notifications automatically here
  -- For group chats, we might want a different strategy, but Phase 1 is 1-to-1 DMs.
  SELECT cm.user_id INTO rec_user_id
  FROM public.conversations c
  JOIN public.conversation_members cm ON c.id = cm.conversation_id
  WHERE c.id = NEW.conversation_id AND c.is_group = false AND cm.user_id != NEW.sender_id
  LIMIT 1;

  IF rec_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (rec_user_id, 'DM_RECEIVED', jsonb_build_object('sender_id', NEW.sender_id, 'conversation_id', NEW.conversation_id, 'message_id', NEW.id));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_message_notifications();

-- Enable Supabase Realtime for Phase 1 tables
-- Adding publications so they show up in realtime stream
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

