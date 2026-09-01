BEGIN;

CREATE OR REPLACE FUNCTION public.calculate_player_rating(
    p_match_id UUID,
    p_player_id UUID
) RETURNS NUMERIC AS $$
DECLARE
    v_rating NUMERIC := 6.0;
    v_is_home BOOLEAN;
    v_timeline_points NUMERIC;
    v_referee_points NUMERIC;
BEGIN
    -- Determine if player is home or away
    SELECT (etp.event_registration_id = m.home_registration_id) INTO v_is_home
    FROM public.event_team_players etp
    JOIN public.matches m ON m.id = p_match_id
    WHERE etp.id = p_player_id;

    -- Calculate timeline points
    SELECT COALESCE(SUM(
        CASE
            -- SHOT
            WHEN event_type = 'SHOT' THEN
                CASE 
                    WHEN metadata->>'result' = 'GOAL' THEN 0.8
                    WHEN metadata->>'result' = 'SAVED' THEN 0.05
                    WHEN metadata->>'result' = 'WOODWORK' THEN 0.05
                    WHEN metadata->>'result' = 'OFF_TARGET' THEN -0.15
                    WHEN metadata->>'result' = 'BLOCKED' THEN -0.1
                    ELSE 0
                END
                + CASE WHEN metadata->>'type' = 'BICYCLE' THEN 0.2 ELSE 0 END
                + CASE WHEN metadata->>'type' IN ('VOLLEY', 'HALF_VOLLEY') THEN 0.1 ELSE 0 END
                + CASE WHEN metadata->>'location' = 'OUTSIDE_BOX' AND metadata->>'result' IN ('GOAL', 'SAVED', 'WOODWORK') THEN 0.1 ELSE 0 END

            -- GOAL (For backwards compatibility)
            WHEN event_type::text = 'GOAL' THEN 0.8

            -- PASS
            WHEN event_type = 'PASS' THEN
                CASE
                    WHEN metadata->>'result' = 'COMPLETED' THEN 0.01
                        + CASE WHEN metadata->>'qualifier' = 'KEY_PASS' THEN 0.2 ELSE 0 END
                        + CASE WHEN metadata->>'qualifier' = 'ASSIST' THEN 0.6 ELSE 0 END
                        + CASE WHEN metadata->>'distance' = 'LONG' THEN 0.02 ELSE 0 END
                        + CASE WHEN metadata->>'type' = 'THROUGH_BALL' THEN 0.1 ELSE 0 END
                        + CASE WHEN y IS NOT NULL AND ((v_is_home AND y < 33) OR (NOT v_is_home AND y > 67)) THEN 0.02 ELSE 0 END -- Final Third bonus
                    WHEN metadata->>'result' IN ('INTERCEPTED', 'BLOCKED', 'OUT_OF_BOUNDS') THEN -0.05
                        - CASE WHEN y IS NOT NULL AND ((v_is_home AND y > 67) OR (NOT v_is_home AND y < 33)) THEN 0.10 ELSE 0 END -- Def third penalty (-0.15 total)
                    ELSE 0
                END

            -- DRIBBLE
            WHEN event_type = 'DRIBBLE' THEN
                CASE
                    WHEN metadata->>'result' = 'SUCCESS' THEN 0.05
                        + CASE WHEN metadata->>'skillType' IN ('NUTMEG', 'RAINBOW', 'ELASTICO') THEN 0.1 ELSE 0 END
                        + CASE WHEN metadata->>'opponentsBeaten' = '2' THEN 0.05 ELSE 0 END
                        + CASE WHEN metadata->>'opponentsBeaten' = '3+' THEN 0.1 ELSE 0 END
                        + CASE WHEN y IS NOT NULL AND ((v_is_home AND y < 33) OR (NOT v_is_home AND y > 67)) THEN 0.02 ELSE 0 END
                    WHEN metadata->>'result' = 'UNSUCCESSFUL' THEN -0.15
                    ELSE -0.15 
                END

            -- CROSS
            WHEN event_type = 'CROSS' THEN
                CASE
                    WHEN metadata->>'result' = 'COMPLETED' THEN 0.05
                    WHEN metadata->>'result' IN ('CLEARED', 'CAUGHT') THEN -0.1
                    WHEN metadata->>'result' = 'OUT' THEN -0.15
                    ELSE 0
                END

            -- TACKLE
            WHEN event_type = 'TACKLE' THEN
                CASE
                    WHEN metadata->>'result' = 'WON_RETAINED' THEN 0.1
                        + CASE WHEN metadata->>'type' = 'SLIDING' THEN 0.05 ELSE 0 END
                        + CASE WHEN y IS NOT NULL AND ((v_is_home AND y > 67) OR (NOT v_is_home AND y < 33)) THEN 0.05 ELSE 0 END
                    WHEN metadata->>'result' = 'WON_LOOSE' THEN 0.05
                        + CASE WHEN metadata->>'type' = 'SLIDING' THEN 0.05 ELSE 0 END
                        + CASE WHEN y IS NOT NULL AND ((v_is_home AND y > 67) OR (NOT v_is_home AND y < 33)) THEN 0.05 ELSE 0 END
                    WHEN metadata->>'result' = 'LOST' THEN -0.15
                    WHEN metadata->>'result' = 'FOUL' THEN -0.25
                    ELSE 0
                END

            -- BALL RECOVERY / INTERCEPTION / CLEARANCE
            WHEN event_type IN ('BALL_RECOVERY', 'INTERCEPTION', 'CLEARANCE', 'BLOCK') THEN
                CASE
                    WHEN event_type = 'INTERCEPTION' OR metadata->>'type' = 'INTERCEPTION' THEN 0.05
                    WHEN event_type = 'CLEARANCE' OR metadata->>'type' = 'CLEARANCE' THEN 0.03
                        + CASE WHEN y IS NOT NULL AND ((v_is_home AND y > 83) OR (NOT v_is_home AND y < 17)) THEN 0.05 ELSE 0 END -- Penalty area clearance
                    WHEN event_type = 'BLOCK' OR metadata->>'type' = 'BLOCK' THEN 0.05
                    WHEN event_type = 'BALL_RECOVERY' OR metadata->>'type' = 'RECOVERY' THEN 0.02
                        + CASE WHEN y IS NOT NULL AND ((v_is_home AND y > 67) OR (NOT v_is_home AND y < 33)) THEN 0.03 ELSE 0 END
                    ELSE 0
                END

            -- AERIAL DUEL
            WHEN event_type = 'AERIAL_DUEL' THEN
                CASE WHEN metadata->>'result' = 'WON' THEN 0.02
                     WHEN metadata->>'result' = 'LOST' THEN -0.05
                     ELSE 0 END

            -- SAVE
            WHEN event_type = 'SAVE' THEN
                CASE
                    WHEN metadata->>'type' = 'CATCH' THEN 0.1
                    WHEN metadata->>'type' = 'PARRY_SAFE' THEN 0.05
                    WHEN metadata->>'type' = 'PARRY_DANGER' THEN -0.05
                    ELSE 0
                END
                + CASE WHEN metadata->>'context' = '1V1' THEN 0.2 ELSE 0 END
                + CASE WHEN metadata->>'context' = 'PENALTY' THEN 0.5 ELSE 0 END

            -- ERROR
            WHEN event_type = 'ERROR' THEN -2.0

            ELSE 0
        END
    ), 0) INTO v_timeline_points
    FROM public.match_timeline_events
    WHERE match_id = p_match_id AND actor_player_id = p_player_id;

    -- Calculate referee points
    SELECT COALESCE(SUM(
        CASE
            WHEN event_type::text = 'FOUL' THEN -0.25
            WHEN event_type::text = 'YELLOW_CARD' THEN -1.5
            WHEN event_type::text = 'RED_CARD' THEN -4.0
            ELSE 0
        END
    ), 0) INTO v_referee_points
    FROM public.referee_events
    WHERE match_id = p_match_id AND event_player_id = p_player_id;

    -- Final calculation
    v_rating := v_rating + v_timeline_points + v_referee_points;

    -- Clamp rating between 1.0 and 10.0
    IF v_rating > 10.0 THEN v_rating := 10.0; END IF;
    IF v_rating < 1.0 THEN v_rating := 1.0; END IF;

    RETURN v_rating;
END;
$$ LANGUAGE plpgsql;

COMMIT;
