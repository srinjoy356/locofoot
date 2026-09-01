-- Phase 4: Ratings & MVP Computation
-- This is calculated deterministically post-match

BEGIN;

CREATE TABLE public.match_player_ratings (
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    event_player_id UUID NOT NULL REFERENCES public.event_team_players(id) ON DELETE CASCADE,
    rating NUMERIC(4,2) NOT NULL DEFAULT 6.0,
    is_potm BOOLEAN NOT NULL DEFAULT false,
    potm_reason TEXT,
    
    PRIMARY KEY(match_id, event_player_id)
);

-- We snapshot the event's rating configuration at the time the match starts
ALTER TABLE public.matches 
    ADD COLUMN rating_weights_snapshot JSONB;

-- A Postgres function to calculate the rating (can be called securely from FastAPI)
CREATE OR REPLACE FUNCTION public.calculate_player_rating(
    p_match_id UUID,
    p_player_id UUID
) RETURNS NUMERIC AS $$
DECLARE
    v_rating NUMERIC := 6.0;
    v_goals INT;
    v_assists INT;
    v_yellows INT;
    v_reds INT;
    v_weights JSONB;
BEGIN
    -- Get snapshot
    SELECT rating_weights_snapshot INTO v_weights FROM public.matches WHERE id = p_match_id;
    IF v_weights IS NULL THEN
        -- Default fallback weights
        v_weights := '{"goal": 1.5, "assist": 1.0, "yellow": -1.0, "red": -3.0}'::jsonb;
    END IF;

    -- Fetch derived stats
    SELECT COALESCE(goals, 0), COALESCE(assists, 0) INTO v_goals, v_assists
    FROM public.player_match_stats_view 
    WHERE match_id = p_match_id AND event_player_id = p_player_id;
    
    SELECT COALESCE(yellow_cards, 0), COALESCE(red_cards, 0) INTO v_yellows, v_reds
    FROM public.player_discipline_stats_view 
    WHERE match_id = p_match_id AND event_player_id = p_player_id;

    v_goals := COALESCE(v_goals, 0);
    v_assists := COALESCE(v_assists, 0);
    v_yellows := COALESCE(v_yellows, 0);
    v_reds := COALESCE(v_reds, 0);

    v_rating := v_rating + (v_goals * COALESCE((v_weights->>'goal')::numeric, 1.5));
    v_rating := v_rating + (v_assists * COALESCE((v_weights->>'assist')::numeric, 1.0));
    v_rating := v_rating + (v_yellows * COALESCE((v_weights->>'yellow')::numeric, -1.0));
    v_rating := v_rating + (v_reds * COALESCE((v_weights->>'red')::numeric, -3.0));

    IF v_rating < 1.0 THEN v_rating := 1.0; END IF;
    IF v_rating > 10.0 THEN v_rating := 10.0; END IF;

    RETURN v_rating;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
