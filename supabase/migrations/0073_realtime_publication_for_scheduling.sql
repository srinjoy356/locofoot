-- The web app subscribes to postgres_changes on these tables (match clock/score, schedules, brackets),
-- but only the timeline/referee tables were ever added to the realtime publication (0035 is commented out).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['matches', 'events', 'schedule_slots', 'slot_field_assignments', 'brackets', 'groups']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
