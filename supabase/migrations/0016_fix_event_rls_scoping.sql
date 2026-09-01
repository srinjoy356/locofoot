-- 0016_fix_event_rls_scoping.sql

-- Drop the old policies
DROP POLICY IF EXISTS "events are publicly readable unless DRAFT" ON public.events;
DROP POLICY IF EXISTS "event_settings are publicly readable unless DRAFT" ON public.event_settings;
DROP POLICY IF EXISTS "event_stat_definitions are publicly readable" ON public.event_stat_definitions;
DROP POLICY IF EXISTS "event_disciplinary_rules are publicly readable" ON public.event_disciplinary_rules;

-- Recreate with explicit table aliases
CREATE POLICY "events are publicly readable unless DRAFT" ON public.events FOR SELECT USING (
  status != 'DRAFT' OR
  EXISTS (
    SELECT 1 FROM public.event_roles er 
    WHERE er.event_id = events.id AND er.user_id = auth.uid() AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
  )
);

CREATE POLICY "event_settings are publicly readable unless DRAFT" ON public.event_settings FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = event_settings.event_id AND (
      e.status != 'DRAFT' OR
      EXISTS (
        SELECT 1 FROM public.event_roles er 
        WHERE er.event_id = e.id AND er.user_id = auth.uid() AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
      )
    )
  )
);

CREATE POLICY "event_stat_definitions are publicly readable" ON public.event_stat_definitions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = event_stat_definitions.event_id AND e.status != 'DRAFT'
  ) OR
  EXISTS (
    SELECT 1 FROM public.event_roles er WHERE er.event_id = event_stat_definitions.event_id AND er.user_id = auth.uid() AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN')
  )
);

CREATE POLICY "event_disciplinary_rules are publicly readable" ON public.event_disciplinary_rules FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = event_disciplinary_rules.event_id AND e.status != 'DRAFT'
  ) OR
  EXISTS (
    SELECT 1 FROM public.event_roles er WHERE er.event_id = event_disciplinary_rules.event_id AND er.user_id = auth.uid() AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN')
  )
);
