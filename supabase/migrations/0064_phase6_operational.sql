-- Phase 6: Live & Operational Polish

-- 1. EVENT ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS public.event_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_emergency BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: event_announcements
ALTER TABLE public.event_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view event announcements" 
ON public.event_announcements FOR SELECT 
USING (true);

CREATE POLICY "Event admins can insert announcements"
ON public.event_announcements FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.event_roles
        WHERE event_roles.event_id = event_announcements.event_id
        AND event_roles.user_id = auth.uid()
        AND event_roles.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
    )
);

CREATE POLICY "Event admins can update announcements"
ON public.event_announcements FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.event_roles
        WHERE event_roles.event_id = event_announcements.event_id
        AND event_roles.user_id = auth.uid()
        AND event_roles.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
    )
);

CREATE POLICY "Event admins can delete announcements"
ON public.event_announcements FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.event_roles
        WHERE event_roles.event_id = event_announcements.event_id
        AND event_roles.user_id = auth.uid()
        AND event_roles.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
    )
);

-- 2. DISPUTES
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('MATCH', 'MATCH_EVENT', 'RESULT', 'OTHER')),
    target_id UUID,
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'MODIFIED')),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- RLS: disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own disputes" 
ON public.disputes FOR SELECT 
USING (reporter_id = auth.uid());

CREATE POLICY "Event admins can view all event disputes" 
ON public.disputes FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.event_roles
        WHERE event_roles.event_id = disputes.event_id
        AND event_roles.user_id = auth.uid()
        AND event_roles.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
    )
);

CREATE POLICY "Authenticated users can create disputes"
ON public.disputes FOR INSERT 
WITH CHECK (
    auth.uid() = reporter_id
);

-- Note: Updates to disputes should be handled by FastAPI, but we can allow EVENT_ADMIN to update if needed.
CREATE POLICY "Event admins can update disputes"
ON public.disputes FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.event_roles
        WHERE event_roles.event_id = disputes.event_id
        AND event_roles.user_id = auth.uid()
        AND event_roles.role IN ('EVENT_OWNER', 'EVENT_ADMIN', 'EVENT_MANAGER')
    )
);

-- 3. REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_type TEXT NOT NULL CHECK (target_type IN ('USER', 'TEAM', 'EVENT', 'MESSAGE', 'OTHER')),
    target_id UUID NOT NULL,
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED')),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- RLS: reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reports" 
ON public.reports FOR SELECT 
USING (reporter_id = auth.uid());

CREATE POLICY "Platform admins can view all reports" 
ON public.reports FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.platform_role IN ('PLATFORM_ADMIN', 'SUPER_ADMIN')
    )
);

CREATE POLICY "Authenticated users can create reports"
ON public.reports FOR INSERT 
WITH CHECK (
    auth.uid() = reporter_id
);

CREATE POLICY "Platform admins can update reports"
ON public.reports FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.platform_role IN ('PLATFORM_ADMIN', 'SUPER_ADMIN')
    )
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_event_announcements_updated_at
BEFORE UPDATE ON public.event_announcements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_reports_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
