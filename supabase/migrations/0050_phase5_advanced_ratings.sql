BEGIN;

-- 1. Create the advanced player rating function
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
                    WHEN metadata->>'result' = 'GOAL' THEN 1.5
                    WHEN metadata->>'result' = 'SAVED' THEN 0.2
                    WHEN metadata->>'result' = 'WOODWORK' THEN 0.1
                    WHEN metadata->>'result' = 'OFF_TARGET' THEN -0.1
                    ELSE 0
                END
                + CASE WHEN metadata->>'type' = 'BICYCLE' THEN 0.2 ELSE 0 END
                + CASE WHEN metadata->>'type' IN ('VOLLEY', 'HALF_VOLLEY') THEN 0.1 ELSE 0 END
                + CASE WHEN metadata->>'location' = 'OUTSIDE_BOX' AND metadata->>'result' IN ('GOAL', 'SAVED', 'WOODWORK') THEN 0.1 ELSE 0 END

            -- PASS
            WHEN event_type = 'PASS' THEN
                CASE
                    WHEN metadata->>'result' = 'COMPLETED' THEN 0.05
                        + CASE WHEN metadata->>'qualifier' = 'KEY_PASS' THEN 0.4 ELSE 0 END
                        + CASE WHEN metadata->>'qualifier' = 'ASSIST' THEN 1.0 ELSE 0 END
                        + CASE WHEN metadata->>'distance' = 'LONG' THEN 0.05 ELSE 0 END
                        + CASE WHEN metadata->>'type' = 'THROUGH_BALL' THEN 0.1 ELSE 0 END
                        + CASE WHEN y IS NOT NULL AND ((v_is_home AND y < 33) OR (NOT v_is_home AND y > 67)) THEN 0.05 ELSE 0 END -- Final Third bonus
                    ELSE -0.05
                        - CASE WHEN metadata->>'distance' = 'LONG' THEN -0.03 ELSE 0 END -- Less punishing (-0.02 total)
                        - CASE WHEN y IS NOT NULL AND ((v_is_home AND y > 67) OR (NOT v_is_home AND y < 33)) THEN 0.10 ELSE 0 END -- Def third penalty (-0.15 total)
                END

            -- DRIBBLE
            WHEN event_type = 'DRIBBLE' THEN
                CASE
                    WHEN metadata->>'result' = 'SUCCESS' THEN 0.1
                        + CASE WHEN metadata->>'skillType' IN ('NUTMEG', 'RAINBOW', 'ELASTICO') THEN 0.15 ELSE 0 END
                        + CASE WHEN metadata->>'opponentsBeaten' = '2' THEN 0.1 ELSE 0 END
                        + CASE WHEN metadata->>'opponentsBeaten' = '3+' THEN 0.2 ELSE 0 END
                        + CASE WHEN y IS NOT NULL AND ((v_is_home AND y < 33) OR (NOT v_is_home AND y > 67)) THEN 0.05 ELSE 0 END
                    ELSE -0.1
                END

            -- CROSS
            WHEN event_type = 'CROSS' THEN
                CASE
                    WHEN metadata->>'result' = 'COMPLETED' THEN 0.15
                    WHEN metadata->>'result' IN ('CLEARED', 'CAUGHT') THEN -0.05
                    WHEN metadata->>'result' = 'OUT' THEN -0.1
                    ELSE 0
                END

            -- TACKLE
            WHEN event_type = 'TACKLE' THEN
                CASE
                    WHEN metadata->>'result' = 'WON_RETAINED' THEN 0.25
                        + CASE WHEN metadata->>'type' = 'SLIDING' THEN 0.1 ELSE 0 END
                        + CASE WHEN y IS NOT NULL AND ((v_is_home AND y > 67) OR (NOT v_is_home AND y < 33)) THEN 0.1 ELSE 0 END
                    WHEN metadata->>'result' = 'WON_LOOSE' THEN 0.15
                        + CASE WHEN metadata->>'type' = 'SLIDING' THEN 0.1 ELSE 0 END
                        + CASE WHEN y IS NOT NULL AND ((v_is_home AND y > 67) OR (NOT v_is_home AND y < 33)) THEN 0.1 ELSE 0 END
                    WHEN metadata->>'result' = 'LOST' THEN -0.1
                    WHEN metadata->>'result' = 'FOUL' THEN -0.15
                    ELSE 0
                END

            -- BALL RECOVERY / INTERCEPTION / CLEARANCE
            WHEN event_type IN ('BALL_RECOVERY', 'INTERCEPTION', 'CLEARANCE', 'BLOCK') THEN
                CASE
                    WHEN event_type = 'INTERCEPTION' OR metadata->>'type' = 'INTERCEPTION' THEN 0.15
                    WHEN event_type = 'CLEARANCE' OR metadata->>'type' = 'CLEARANCE' THEN 0.1
                        + CASE WHEN y IS NOT NULL AND ((v_is_home AND y > 83) OR (NOT v_is_home AND y < 17)) THEN 0.1 ELSE 0 END -- Penalty area clearance
                    WHEN event_type = 'BLOCK' OR metadata->>'type' = 'BLOCK' THEN 0.15
                    WHEN event_type = 'BALL_RECOVERY' OR metadata->>'type' = 'RECOVERY' THEN 0.05
                    ELSE 0
                END
                + CASE WHEN y IS NOT NULL AND ((v_is_home AND y > 67) OR (NOT v_is_home AND y < 33)) THEN 0.05 ELSE 0 END

            -- AERIAL DUEL
            WHEN event_type = 'AERIAL_DUEL' THEN
                CASE WHEN metadata->>'result' = 'WON' THEN 0.1 ELSE 0 END

            -- SAVE
            WHEN event_type = 'SAVE' THEN
                0.3
                + CASE WHEN metadata->>'type' = 'CATCH' THEN 0.1 ELSE 0 END
                - CASE WHEN metadata->>'type' = 'PARRY_DANGER' THEN 0.1 ELSE 0 END
                + CASE WHEN metadata->>'context' = '1V1' THEN 0.3 ELSE 0 END
                + CASE WHEN metadata->>'context' = 'PENALTY' THEN 0.8 ELSE 0 END

            -- ERRORS
            WHEN event_type = 'ERROR' THEN -1.5

            ELSE 0
        END
    ), 0) INTO v_timeline_points
    FROM public.match_timeline_events 
    WHERE match_id = p_match_id AND actor_player_id = p_player_id;

    -- Calculate referee points
    SELECT COALESCE(SUM(
        CASE
            WHEN event_type::text = 'FOUL' THEN -0.15
            WHEN event_type::text = 'YELLOW_CARD' THEN -1.0
            WHEN event_type::text = 'RED_CARD' THEN -3.0
            ELSE 0
        END
    ), 0) INTO v_referee_points
    FROM public.referee_events
    WHERE match_id = p_match_id AND event_player_id = p_player_id;

    v_rating := 6.0 + v_timeline_points + v_referee_points;

    -- Clamp rating
    IF v_rating < 1.0 THEN v_rating := 1.0; END IF;
    IF v_rating > 10.0 THEN v_rating := 10.0; END IF;

    RETURN v_rating;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix backward compatibility for BALL_RECOVERY in Match Statistics Overview
DROP VIEW IF EXISTS public.match_statistics_overview_view CASCADE;
CREATE OR REPLACE VIEW public.match_statistics_overview_view AS
WITH match_info AS (
    SELECT 
        m.id,
        m.home_registration_id,
        m.away_registration_id,
        m.home_score,
        m.away_score
    FROM public.matches m
),
home_stats AS (
    SELECT 
        m.id AS match_id,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' = 'GOAL') AS goals,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS' AND mte.metadata->>'qualifier' = 'ASSIST') AS assists,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT') AS shots,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' IN ('GOAL', 'SAVED', 'WOODWORK')) AS shots_on_target,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS') AS passes,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS' AND mte.metadata->>'result' = 'COMPLETED') AS passes_completed,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'DRIBBLE' AND mte.metadata->>'result' = 'SUCCESS') AS successful_dribbles,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'TACKLE' AND mte.metadata->>'result' IN ('WON_RETAINED', 'WON_LOOSE')) AS tackles_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'INTERCEPTION' OR (mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' = 'INTERCEPTION')) AS interceptions,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' != 'INTERCEPTION' AND mte.metadata->>'type' != 'CLEARANCE') AS recoveries,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'CLEARANCE' OR (mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' = 'CLEARANCE')) AS clearances,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'AERIAL_DUEL') AS aerial_duels_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BLOCK') AS blocks,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SAVE') AS saves
    FROM match_info m
    LEFT JOIN public.match_timeline_events mte ON mte.match_id = m.id AND mte.actor_registration_id = m.home_registration_id
    GROUP BY m.id
),
away_stats AS (
    SELECT 
        m.id AS match_id,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' = 'GOAL') AS goals,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS' AND mte.metadata->>'qualifier' = 'ASSIST') AS assists,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT') AS shots,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' IN ('GOAL', 'SAVED', 'WOODWORK')) AS shots_on_target,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS') AS passes,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS' AND mte.metadata->>'result' = 'COMPLETED') AS passes_completed,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'DRIBBLE' AND mte.metadata->>'result' = 'SUCCESS') AS successful_dribbles,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'TACKLE' AND mte.metadata->>'result' IN ('WON_RETAINED', 'WON_LOOSE')) AS tackles_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'INTERCEPTION' OR (mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' = 'INTERCEPTION')) AS interceptions,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' != 'INTERCEPTION' AND mte.metadata->>'type' != 'CLEARANCE') AS recoveries,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'CLEARANCE' OR (mte.event_type::text = 'BALL_RECOVERY' AND mte.metadata->>'type' = 'CLEARANCE')) AS clearances,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'AERIAL_DUEL') AS aerial_duels_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BLOCK') AS blocks,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SAVE') AS saves
    FROM match_info m
    LEFT JOIN public.match_timeline_events mte ON mte.match_id = m.id AND mte.actor_registration_id = m.away_registration_id
    GROUP BY m.id
),
home_referee AS (
    SELECT 
        m.id AS match_id,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'FOUL') AS fouls,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'YELLOW_CARD') AS yellow_cards,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'RED_CARD') AS red_cards
    FROM match_info m
    LEFT JOIN public.referee_events re ON re.match_id = m.id AND re.event_registration_id = m.home_registration_id
    GROUP BY m.id
),
away_referee AS (
    SELECT 
        m.id AS match_id,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'FOUL') AS fouls,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'YELLOW_CARD') AS yellow_cards,
        COUNT(re.id) FILTER (WHERE re.event_type::text = 'RED_CARD') AS red_cards
    FROM match_info m
    LEFT JOIN public.referee_events re ON re.match_id = m.id AND re.event_registration_id = m.away_registration_id
    GROUP BY m.id
)
SELECT 
    m.id AS match_id,
    COALESCE(h.goals, 0) AS home_goals,
    COALESCE(a.goals, 0) AS away_goals,
    COALESCE(h.assists, 0) AS home_assists,
    COALESCE(a.assists, 0) AS away_assists,
    COALESCE(h.shots, 0) AS home_shots,
    COALESCE(a.shots, 0) AS away_shots,
    COALESCE(h.shots_on_target, 0) AS home_shots_on_target,
    COALESCE(a.shots_on_target, 0) AS away_shots_on_target,
    COALESCE(h.passes, 0) AS home_passes,
    COALESCE(a.passes, 0) AS away_passes,
    COALESCE(h.passes_completed, 0) AS home_passes_completed,
    COALESCE(a.passes_completed, 0) AS away_passes_completed,
    CASE WHEN COALESCE(h.passes, 0) > 0 THEN ROUND((h.passes_completed::numeric / h.passes::numeric) * 100, 1) ELSE 0 END AS home_pass_accuracy_percent,
    CASE WHEN COALESCE(a.passes, 0) > 0 THEN ROUND((a.passes_completed::numeric / a.passes::numeric) * 100, 1) ELSE 0 END AS away_pass_accuracy_percent,
    COALESCE(h.successful_dribbles, 0) AS home_successful_dribbles,
    COALESCE(a.successful_dribbles, 0) AS away_successful_dribbles,
    COALESCE(h.tackles_won, 0) AS home_tackles_won,
    COALESCE(a.tackles_won, 0) AS away_tackles_won,
    COALESCE(h.interceptions, 0) AS home_interceptions,
    COALESCE(a.interceptions, 0) AS away_interceptions,
    COALESCE(h.recoveries, 0) AS home_recoveries,
    COALESCE(a.recoveries, 0) AS away_recoveries,
    COALESCE(h.clearances, 0) AS home_clearances,
    COALESCE(a.clearances, 0) AS away_clearances,
    COALESCE(h.aerial_duels_won, 0) AS home_aerial_duels_won,
    COALESCE(a.aerial_duels_won, 0) AS away_aerial_duels_won,
    COALESCE(h.blocks, 0) AS home_blocks,
    COALESCE(a.blocks, 0) AS away_blocks,
    COALESCE(h.saves, 0) AS home_saves,
    COALESCE(a.saves, 0) AS away_saves,
    COALESCE(hr.fouls, 0) AS home_fouls,
    COALESCE(ar.fouls, 0) AS away_fouls,
    COALESCE(hr.yellow_cards, 0) AS home_yellow_cards,
    COALESCE(ar.yellow_cards, 0) AS away_yellow_cards,
    COALESCE(hr.red_cards, 0) AS home_red_cards,
    COALESCE(ar.red_cards, 0) AS away_red_cards
FROM match_info m
LEFT JOIN home_stats h ON h.match_id = m.id
LEFT JOIN away_stats a ON a.match_id = m.id
LEFT JOIN home_referee hr ON hr.match_id = m.id
LEFT JOIN away_referee ar ON ar.match_id = m.id;

COMMIT;
