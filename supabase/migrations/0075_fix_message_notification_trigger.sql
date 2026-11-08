-- Sending any chat message failed on a database built from the migrations: the trigger read conversations.type,
-- a column that only existed on the hand-edited hosted DB. conversations has is_group; use that.
CREATE OR REPLACE FUNCTION public.handle_message_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_other_user UUID;
  v_is_group boolean;
BEGIN
  SELECT is_group INTO v_is_group FROM public.conversations WHERE id = NEW.conversation_id;

  -- only 1:1 conversations notify automatically (the enum value is DM_RECEIVED; 0011 used a NEW_MESSAGE that never existed)
  IF v_is_group IS FALSE THEN
    SELECT user_id INTO v_other_user FROM public.conversation_members
      WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id LIMIT 1;
    IF v_other_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, payload)
      VALUES (v_other_user, 'DM_RECEIVED', jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id, 'message_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
