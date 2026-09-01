-- Phase 4: Event Timeline Engine

BEGIN;

CREATE TYPE public.timeline_event_type AS ENUM (
    'PASS',
    'SHOT', -- Result=GOAL means goal.
    'DRIBBLE',
    'TACKLE',
    'INTERCEPTION',
    'BALL_RECOVERY',
    'CLEARANCE',
    'BLOCK',
    'AERIAL_DUEL',
    'SAVE',
    'AERIAL_CLAIM',
    'SWEEPER_ACTION',
    'DISTRIBUTION',
    'CORNER',
    'FREE_KICK',
    'DROP_BALL',
    'OFF_BALL_RUN',
    'ERROR',
    'INJURY_NOTE',
    'OTHER'
);

CREATE TABLE public.match_timeline_events (
    id UUID PRIMARY KEY, -- Client-generated UUID for idempotency
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    event_type public.timeline_event_type NOT NULL,
    period public.match_period NOT NULL,
    elapsed_seconds INT NOT NULL,
    display_minute INT NOT NULL,
    display_second INT NOT NULL,
    
    -- Actors (Linked to Registration, NOT global teams)
    actor_player_id UUID REFERENCES public.event_team_players(id) ON DELETE CASCADE,
    actor_registration_id UUID REFERENCES public.event_team_registrations(id) ON DELETE CASCADE,
    
    -- Target (Optional, e.g. Pass recipient, Tackle opponent)
    target_player_id UUID REFERENCES public.event_team_players(id) ON DELETE CASCADE,
    target_registration_id UUID REFERENCES public.event_team_registrations(id) ON DELETE CASCADE,
    
    -- Pitch Coordinates (0-100)
    x FLOAT CHECK (x >= 0 AND x <= 100),
    y FLOAT CHECK (y >= 0 AND y <= 100),
    
    -- Reference to System A (e.g. Tackle resulted in Foul referee_event_id)
    referee_event_id UUID REFERENCES public.referee_events(id) ON DELETE SET NULL,
    
    -- Rich context (xG features, pass types, shot results, etc)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Immutable Corrections Audit Log
CREATE TABLE public.event_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    timeline_event_id UUID NOT NULL REFERENCES public.match_timeline_events(id) ON DELETE CASCADE,
    
    original_payload JSONB NOT NULL,
    corrected_payload JSONB NOT NULL,
    reason TEXT,
    
    corrected_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Realtime Configuration
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_timeline_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_corrections;

-- RLS Policies
ALTER TABLE public.match_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read match_timeline_events" ON public.match_timeline_events
    FOR SELECT TO public USING (true);

ALTER TABLE public.event_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read event_corrections" ON public.event_corrections
    FOR SELECT TO public USING (true);

COMMIT;
