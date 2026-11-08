-- 0067 recreated this policy with an unqualified `id`, which inside the subquery resolves to event_roles.id (er.event_id = er.id),
-- so owners could not read their own DRAFT events (the state every new event starts in). 0016 had already fixed it once.
DROP POLICY IF EXISTS "events are publicly readable unless DRAFT" ON public.events;
CREATE POLICY "events are publicly readable unless DRAFT" ON public.events FOR SELECT USING (
  status != 'DRAFT' OR
  EXISTS (
    SELECT 1 FROM public.event_roles er
    WHERE er.event_id = events.id AND er.user_id = auth.uid() AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
  )
);
