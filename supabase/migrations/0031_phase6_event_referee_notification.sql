-- 0031_phase6_event_referee_notification.sql

-- Trigger to notify when a user is granted the REFEREE role for an event
CREATE OR REPLACE FUNCTION public.fn_event_role_notifications()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'REFEREE' THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      NEW.user_id,
      'EVENT_REFEREE_ASSIGNED',
      jsonb_build_object('event_id', NEW.event_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_event_role_notifications
  AFTER INSERT ON public.event_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_event_role_notifications();
