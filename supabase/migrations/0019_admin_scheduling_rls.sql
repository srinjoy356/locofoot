-- Admin policies for scheduling tables

CREATE POLICY "Admin matches access" ON public.matches
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.event_roles
            WHERE event_id = matches.event_id
            AND user_id = auth.uid()
            AND role IN ('EVENT_OWNER', 'EVENT_ADMIN')
        )
    );

CREATE POLICY "Admin slots access" ON public.schedule_slots
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.event_roles
            WHERE event_id = schedule_slots.event_id
            AND user_id = auth.uid()
            AND role IN ('EVENT_OWNER', 'EVENT_ADMIN')
        )
    );

CREATE POLICY "Admin slot assignments access" ON public.slot_field_assignments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.schedule_slots ss
            JOIN public.event_roles er ON er.event_id = ss.event_id
            WHERE ss.id = slot_field_assignments.schedule_slot_id
            AND er.user_id = auth.uid()
            AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN')
        )
    );
