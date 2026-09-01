-- Phase 4: Matchday & Referee Engine
-- Strictly maintains the Referee vs Timeline boundary.

BEGIN;

-- 1. REFEREE ASSIGNMENT MODEL
CREATE TYPE public.referee_status AS ENUM (
    'ASSIGNED',
    'ACCEPTED',
    'DECLINED',
    'REPLACEMENT'
);

CREATE TABLE public.match_referees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status public.referee_status NOT NULL DEFAULT 'ASSIGNED',
    assigned_by UUID REFERENCES auth.users(id),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    UNIQUE(match_id, user_id)
);

-- 2. MATCH STATES
CREATE TYPE public.match_state AS ENUM (
    'SCHEDULED',
    'PRE_MATCH',
    'READY',
    'LIVE',
    'HALF_TIME',
    'SECOND_HALF',
    'EXTRA_TIME_1',
    'EXTRA_TIME_BREAK',
    'EXTRA_TIME_2',
    'PENALTY_SHOOTOUT',
    'FULL_TIME',
    'COMPLETED',
    'PAUSED',
    'ABANDONED',
    'POSTPONED',
    'CANCELLED'
);

ALTER TABLE public.matches
    ADD COLUMN match_state public.match_state NOT NULL DEFAULT 'SCHEDULED';
    
    
    
    

CREATE TABLE public.match_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    previous_state public.match_state,
    new_state public.match_state NOT NULL,
    reason TEXT,
    actor_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- 3. REFEREE EVENTS
CREATE TYPE public.referee_event_type AS ENUM (
    'PERIOD_START',
    'PERIOD_END',
    'STOPPAGE_START',
    'STOPPAGE_END',
    'SUBSTITUTION',
    'FOUL',
    'WARNING',
    'YELLOW_CARD',
    'RED_CARD', -- Direct or 2nd Yellow
    'OFFSIDE',
    'OFFICIAL_DECISION'
);

CREATE TYPE public.match_period AS ENUM (
    'PRE_MATCH',
    'FIRST_HALF',
    'HALF_TIME',
    'SECOND_HALF',
    'EXTRA_TIME_1',
    'EXTRA_TIME_BREAK',
    'EXTRA_TIME_2',
    'PENALTY_SHOOTOUT',
    'POST_MATCH'
);

CREATE TABLE public.referee_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    event_type public.referee_event_type NOT NULL,
    period public.match_period NOT NULL,
    elapsed_seconds INT NOT NULL,
    display_minute INT NOT NULL,
    display_second INT NOT NULL,
    
    -- Actor (Referee)
    created_by UUID REFERENCES auth.users(id),
    
    -- Target Entities (Optional depending on event)
    event_player_id UUID REFERENCES public.event_team_players(id) ON DELETE CASCADE,
    event_registration_id UUID REFERENCES public.event_team_registrations(id) ON DELETE CASCADE,
    
    -- Flexible metadata (e.g., foul type, stoppage reason)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- 4. MATCH PARTICIPATION (For Clean Sheets / Minutes)
CREATE TABLE public.match_participation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    event_player_id UUID NOT NULL REFERENCES public.event_team_players(id) ON DELETE CASCADE,
    event_registration_id UUID NOT NULL REFERENCES public.event_team_registrations(id) ON DELETE CASCADE,
    
    -- Precise intervals
    entry_elapsed_seconds INT,
    exit_elapsed_seconds INT,
    
    -- If null, they are still on the pitch. Calculated at full-time.
    minutes_played INT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Realtime Configuration
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_referees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_state_transitions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.referee_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_participation;

-- RLS Policies

-- Match Referees
ALTER TABLE public.match_referees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read match_referees" ON public.match_referees
    FOR SELECT TO public USING (true);

CREATE POLICY "Event Admins manage match_referees" ON public.match_referees
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.matches m
            JOIN public.event_roles er ON er.event_id = m.event_id
            WHERE m.id = match_referees.match_id
            AND er.user_id = auth.uid()
            AND er.role IN ('EVENT_OWNER', 'EVENT_ADMIN')
        )
    );

CREATE POLICY "Referees can update own assignment" ON public.match_referees
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- Match State Transitions
ALTER TABLE public.match_state_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read match_state_transitions" ON public.match_state_transitions
    FOR SELECT TO public USING (true);

-- Referee Events
ALTER TABLE public.referee_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read referee_events" ON public.referee_events
    FOR SELECT TO public USING (true);

-- Match Participation
ALTER TABLE public.match_participation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read match_participation" ON public.match_participation
    FOR SELECT TO public USING (true);

COMMIT;
