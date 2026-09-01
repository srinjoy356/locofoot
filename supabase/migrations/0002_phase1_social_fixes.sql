CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT TO authenticated USING (public.is_conversation_member(id));

DROP POLICY IF EXISTS "conversation_members_select" ON public.conversation_members;
CREATE POLICY "conversation_members_select" ON public.conversation_members FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND
  public.is_conversation_member(conversation_id) AND
  NOT EXISTS (
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
