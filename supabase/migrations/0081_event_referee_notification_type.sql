-- 0068 filed "you are a tournament referee" under REFEREE_ASSIGNED, the type for a single match. The app then showed an
-- "Accept Match" button that sent an undefined match id. EVENT_REFEREE_ASSIGNED has existed since 0032, so use it.
CREATE OR REPLACE FUNCTION public.fn_event_role_notifications()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'REFEREE' THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (NEW.user_id, 'EVENT_REFEREE_ASSIGNED', jsonb_build_object('event_id', NEW.event_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE public.notifications
SET type = 'EVENT_REFEREE_ASSIGNED'
WHERE type = 'REFEREE_ASSIGNED' AND payload ? 'event_id' AND NOT payload ? 'match_id';
