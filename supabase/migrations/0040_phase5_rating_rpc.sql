-- Phase 5: Calculate Match Ratings and MVP

BEGIN;

CREATE OR REPLACE FUNCTION public.compute_match_ratings_and_mvp(
    p_match_id UUID
) RETURNS VOID AS $$
DECLARE
    v_home_team UUID;
    v_away_team UUID;
    v_home_score INT;
    v_away_score INT;
    v_winning_team UUID;
    v_player_id UUID;
    v_rating NUMERIC;
    v_mvp_player_id UUID := NULL;
    v_max_rating NUMERIC := -1;
    v_mvp_reason TEXT := '';
BEGIN
    -- 1. Get match info
    SELECT home_registration_id, away_registration_id, home_score, away_score
    INTO v_home_team, v_away_team, v_home_score, v_away_score
    FROM public.matches
    WHERE id = p_match_id;

    -- Determine winner
    IF v_home_score > v_away_score THEN
        v_winning_team := v_home_team;
    ELSIF v_away_score > v_home_score THEN
        v_winning_team := v_away_team;
    ELSE
        v_winning_team := NULL; -- Draw
    END IF;

    -- 2. Clear existing ratings for this match
    DELETE FROM public.match_player_ratings WHERE match_id = p_match_id;

    -- 3. Calculate and insert rating for each participating player
    FOR v_player_id IN
        SELECT event_player_id FROM public.player_match_stats_view WHERE match_id = p_match_id
    LOOP
        v_rating := public.calculate_player_rating(p_match_id, v_player_id);

        INSERT INTO public.match_player_ratings (
            match_id, event_player_id, rating, is_potm, potm_reason
        ) VALUES (
            p_match_id, v_player_id, v_rating, false, NULL
        );
    END LOOP;

    -- 4. Calculate MVP/POTM
    -- Filter: Must be on Winning team (unless draw)
    -- Sort: Rating DESC, Goals DESC, Assists DESC
    SELECT 
        mpr.event_player_id, mpr.rating
    INTO v_mvp_player_id, v_max_rating
    FROM public.match_player_ratings mpr
    JOIN public.event_team_players etp ON etp.id = mpr.event_player_id
    JOIN public.player_match_stats_view pms ON pms.match_id = p_match_id AND pms.event_player_id = mpr.event_player_id
    WHERE mpr.match_id = p_match_id
      AND (v_winning_team IS NULL OR etp.event_registration_id = v_winning_team)
    ORDER BY 
        mpr.rating DESC,
        pms.goals DESC,
        pms.assists DESC,
        -- fallback to random deterministic (UUID text sort) if exactly tied
        mpr.event_player_id::TEXT ASC
    LIMIT 1;

    -- 5. Update POTM
    IF v_mvp_player_id IS NOT NULL THEN
        UPDATE public.match_player_ratings
        SET is_potm = true,
            potm_reason = 'Highest rating (' || v_max_rating || ') on the ' || CASE WHEN v_winning_team IS NOT NULL THEN 'winning team.' ELSE 'pitch (draw).' END
        WHERE match_id = p_match_id AND event_player_id = v_mvp_player_id;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

COMMIT;
