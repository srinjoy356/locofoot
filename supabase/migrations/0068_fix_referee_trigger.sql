-- 0068_fix_referee_trigger.sql

-- Fix the trigger to use the correct enum value 'REFEREE_ASSIGNED' instead of 'EVENT_REFEREE_ASSIGNED'
CREATE OR REPLACE FUNCTION public.fn_event_role_notifications()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'REFEREE' THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      NEW.user_id,
      'REFEREE_ASSIGNED',
      jsonb_build_object('event_id', NEW.event_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
