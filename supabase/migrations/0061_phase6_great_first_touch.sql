-- Phase 6: Great First Touch Feature
BEGIN;

-- 1. Add GREAT_FIRST_TOUCH to timeline_event_type enum
-- ALTER TYPE public.timeline_event_type ADD VALUE IF NOT EXISTS 'GREAT_FIRST_TOUCH';
-- Already done in the separate commit block earlier or if it failed, it might need to be outside transactions.
-- Supabase db push handles it if it's the first statement in the file. Wait, in my previous 0061, I had a separate COMMIT block for it. I will keep it separate.
COMMIT;

BEGIN;
ALTER TYPE public.timeline_event_type ADD VALUE IF NOT EXISTS 'GREAT_FIRST_TOUCH';
COMMIT;

BEGIN;
-- 2. Update player_match_stats_view to include great_first_touches
DROP VIEW IF EXISTS public.player_match_stats_view CASCADE;

CREATE OR REPLACE VIEW public.player_match_stats_view AS
WITH timeline_events_with_lead AS (
    SELECT 
        mte.match_id,
        mte.actor_player_id AS event_player_id,
        mte.event_type,
        mte.metadata,
        mte.is_nutmeg,
        mte.actor_registration_id,
        LEAD(mte.event_type) OVER (PARTITION BY mte.match_id, mte.actor_registration_id ORDER BY mte.created_at) AS next_team_event_type,
        LEAD(mte.metadata->>'result') OVER (PARTITION BY mte.match_id, mte.actor_registration_id ORDER BY mte.created_at) AS next_team_event_result
    FROM public.match_timeline_events mte
    WHERE mte.actor_player_id IS NOT NULL
),
timeline_aggs AS (
    SELECT 
        match_id,
        event_player_id,
        COUNT(*) FILTER (WHERE event_type = 'SHOT' AND metadata->>'result' = 'GOAL') AS goals,
        COUNT(*) FILTER (WHERE event_type = 'SHOT' AND metadata->>'result' = 'GOAL' AND metadata->>'situation' = 'PENALTY') AS penalty_goals,
        COUNT(*) FILTER (WHERE event_type = 'SHOT') AS shots,
        COUNT(*) FILTER (WHERE event_type = 'SHOT' AND metadata->>'result' IN ('GOAL', 'SAVED')) AS shots_on_target,
        
        -- Passes
        COUNT(*) FILTER (WHERE event_type = 'PASS') AS passes_attempted,
        COUNT(*) FILTER (WHERE event_type = 'PASS' AND metadata->>'result' = 'COMPLETED') AS passes_completed,
        COUNT(*) FILTER (WHERE event_type = 'PASS' AND metadata->>'type' = 'THROUGH_BALL' AND metadata->>'result' = 'COMPLETED') AS through_balls,
        COUNT(*) FILTER (WHERE event_type = 'PASS' AND metadata->>'type' = 'CROSS' AND metadata->>'result' = 'COMPLETED') AS crosses,
        
        -- Key Passes & Assists
        COUNT(*) FILTER (WHERE event_type = 'PASS' AND (metadata->>'qualifier' = 'ASSIST' OR metadata->>'assist' = 'true')) AS assists,
        -- Relational Key Pass
        COUNT(*) FILTER (WHERE event_type = 'PASS' AND metadata->>'result' = 'COMPLETED' AND next_team_event_type = 'SHOT' AND next_team_event_result IN ('GOAL', 'SAVED')) AS key_passes,
        
        -- Dribbling & Control
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE') AS dribbles_attempted,
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE' AND metadata->>'result' = 'SUCCESS') AS successful_dribbles,
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE' AND (metadata->>'opponents_beaten')::int >= 2) AS ankle_breakers,
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE' AND is_nutmeg = true) AS nutmegs,
        COUNT(*) FILTER (WHERE event_type = 'GREAT_FIRST_TOUCH') AS great_first_touches,
        
        -- Defending
        COUNT(*) FILTER (WHERE event_type = 'TACKLE') AS tackles_attempted,
        COUNT(*) FILTER (WHERE event_type = 'TACKLE' AND metadata->>'result' IN ('WON_RETAINED', 'WON_LOOSE')) AS tackles_won,
        COUNT(*) FILTER (WHERE event_type = 'INTERCEPTION') AS interceptions,
        COUNT(*) FILTER (WHERE event_type = 'BALL_RECOVERY') AS recoveries,
        COUNT(*) FILTER (WHERE event_type = 'CLEARANCE') AS clearances,
        COUNT(*) FILTER (WHERE event_type = 'BLOCK') AS blocks,
        COUNT(*) FILTER (WHERE event_type = 'AERIAL_DUEL' AND metadata->>'result' = 'WON') AS aerials_won,
        
        -- Goalkeeping
        COUNT(*) FILTER (WHERE event_type = 'SAVE') AS saves,
        COUNT(*) FILTER (WHERE event_type = 'SAVE' AND metadata->>'context' = 'PENALTY') AS penalty_saves,
        COUNT(*) FILTER (WHERE event_type = 'SAVE' AND metadata->>'context' = '1V1') AS saves_1v1
    FROM timeline_events_with_lead
    GROUP BY match_id, event_player_id
),
referee_aggs AS (
    SELECT 
        re.match_id,
        re.event_player_id,
        COUNT(*) FILTER (WHERE re.event_type = 'FOUL') AS fouls_committed,
        COUNT(*) FILTER (WHERE re.event_type = 'YELLOW_CARD') AS yellow_cards,
        COUNT(*) FILTER (WHERE re.event_type = 'RED_CARD') AS red_cards
    FROM public.referee_events re
    WHERE re.event_player_id IS NOT NULL
    GROUP BY re.match_id, re.event_player_id
),
fouls_drawn_aggs AS (
    SELECT 
        re.match_id,
        re.target_player_id AS event_player_id,
        COUNT(*) AS fouls_drawn
    FROM public.referee_events re
    WHERE re.event_type = 'FOUL' AND re.target_player_id IS NOT NULL
    GROUP BY re.match_id, re.target_player_id
)
SELECT 
    COALESCE(t.match_id, r.match_id, fd.match_id) AS match_id,
    COALESCE(t.event_player_id, r.event_player_id, fd.event_player_id) AS event_player_id,
    
    COALESCE(t.goals, 0) AS goals,
    COALESCE(t.penalty_goals, 0) AS penalty_goals,
    COALESCE(t.assists, 0) AS assists,
    COALESCE(t.shots, 0) AS shots,
    COALESCE(t.shots_on_target, 0) AS shots_on_target,
    
    COALESCE(t.passes_attempted, 0) AS passes_attempted,
    COALESCE(t.passes_completed, 0) AS passes_completed,
    COALESCE(t.key_passes, 0) AS key_passes,
    COALESCE(t.through_balls, 0) AS through_balls,
    COALESCE(t.crosses, 0) AS crosses,
    
    COALESCE(t.dribbles_attempted, 0) AS dribbles_attempted,
    COALESCE(t.successful_dribbles, 0) AS successful_dribbles,
    COALESCE(t.ankle_breakers, 0) AS ankle_breakers,
    COALESCE(t.nutmegs, 0) AS nutmegs,
    COALESCE(t.great_first_touches, 0) AS great_first_touches,
    
    COALESCE(t.tackles_attempted, 0) AS tackles_attempted,
    COALESCE(t.tackles_won, 0) AS tackles_won,
    COALESCE(t.interceptions, 0) AS interceptions,
    COALESCE(t.recoveries, 0) AS recoveries,
    COALESCE(t.clearances, 0) AS clearances,
    COALESCE(t.blocks, 0) AS blocks,
    COALESCE(t.aerials_won, 0) AS aerials_won,
    
    COALESCE(t.saves, 0) AS saves,
    COALESCE(t.penalty_saves, 0) AS penalty_saves,
    COALESCE(t.saves_1v1, 0) AS saves_1v1,
    
    COALESCE(r.fouls_committed, 0) AS fouls_committed,
    COALESCE(fd.fouls_drawn, 0) AS fouls_drawn,
    COALESCE(r.yellow_cards, 0) AS yellow_cards,
    COALESCE(r.red_cards, 0) AS red_cards
    
FROM timeline_aggs t
FULL OUTER JOIN referee_aggs r ON t.match_id = r.match_id AND t.event_player_id = r.event_player_id
FULL OUTER JOIN fouls_drawn_aggs fd ON COALESCE(t.match_id, r.match_id) = fd.match_id AND COALESCE(t.event_player_id, r.event_player_id) = fd.event_player_id;


-- 3. Recreate match_player_performance_view (since DROP CASCADE removed it)
CREATE OR REPLACE VIEW public.match_player_performance_view AS
SELECT 
    COALESCE(mp.match_id, pms.match_id, pds.match_id) AS match_id,
    COALESCE(mp.event_player_id, pms.event_player_id, pds.event_player_id) AS player_id,
    COALESCE(u.display_name, u.username, 'Unknown Player') AS player_name,
    COALESCE(mp.event_registration_id, etp.event_registration_id) AS registration_id,
    COALESCE(mp.status, 'STARTER'::public.participation_status) AS status,
    COALESCE(
        ROUND((
            COALESCE(
                mp.exit_elapsed_seconds, 
                (SELECT MAX(elapsed_seconds) FROM public.match_timeline_events WHERE match_id = COALESCE(mp.match_id, pms.match_id, pds.match_id)),
                5400
            ) - COALESCE(mp.entry_elapsed_seconds, 0)
        )::numeric / 60, 0), 
    0) AS minutes_played,
    COALESCE(pms.goals, 0) AS goals,
    COALESCE(pms.assists, 0) AS assists,
    COALESCE(pms.shots, 0) AS shots,
    COALESCE(pms.shots_on_target, 0) AS shots_on_target,
    COALESCE(pms.passes_attempted, 0) AS passes_attempted,
    COALESCE(pms.passes_completed, 0) AS passes_completed,
    CASE WHEN pms.passes_attempted > 0 THEN ROUND((pms.passes_completed::numeric / pms.passes_attempted::numeric) * 100, 1) ELSE 0 END AS pass_accuracy,
    COALESCE(pms.successful_dribbles, 0) AS successful_dribbles,
    COALESCE(pms.tackles_won, 0) AS tackles_won,
    COALESCE(pms.recoveries, 0) AS recoveries,
    COALESCE(pds.fouls_committed, 0) AS fouls_committed,
    COALESCE(pds.yellow_cards, 0) AS yellow_cards,
    COALESCE(pds.red_cards, 0) AS red_cards,
    mpr.rating,
    mpr.is_potm AS is_mvp
FROM public.match_participation mp
FULL OUTER JOIN public.player_match_stats_view pms ON pms.match_id = mp.match_id AND pms.event_player_id = mp.event_player_id
FULL OUTER JOIN public.player_discipline_stats_view pds ON pds.match_id = COALESCE(mp.match_id, pms.match_id) AND pds.event_player_id = COALESCE(mp.event_player_id, pms.event_player_id)
LEFT JOIN public.event_team_players etp ON etp.id = COALESCE(mp.event_player_id, pms.event_player_id, pds.event_player_id)
LEFT JOIN public.users u ON u.id = etp.user_id
LEFT JOIN public.match_player_ratings mpr ON mpr.match_id = COALESCE(mp.match_id, pms.match_id, pds.match_id) AND mpr.event_player_id = COALESCE(mp.event_player_id, pms.event_player_id, pds.event_player_id);


-- 4. Recreate tournament_playmaking_stats_view
CREATE OR REPLACE VIEW public.tournament_playmaking_stats_view AS
SELECT 
    m.event_id,
    pms.event_player_id,
    SUM(pms.assists) AS total_assists,
    SUM(pms.key_passes) AS total_key_passes,
    SUM(pms.passes_attempted) AS total_passes_attempted,
    SUM(pms.passes_completed) AS total_passes_completed,
    CASE 
        WHEN SUM(pms.passes_attempted) > 0 THEN 
            ROUND((SUM(pms.passes_completed)::numeric / SUM(pms.passes_attempted)::numeric) * 100, 1)
        ELSE 0 
    END AS pass_completion_rate,
    SUM(pms.crosses) AS total_crosses,
    SUM(pms.through_balls) AS total_through_balls,
    SUM(pms.great_first_touches) AS total_great_first_touches
FROM public.player_match_stats_view pms
JOIN public.matches m ON pms.match_id = m.id
WHERE m.match_state = 'COMPLETED'
GROUP BY m.event_id, pms.event_player_id;

-- 5. Recreate tournament_player_stats_view
CREATE OR REPLACE VIEW public.tournament_player_stats_view AS
SELECT 
    et.event_id,
    etp.id AS event_player_id,
    u.unique_code AS player_unique_code,
    COALESCE(u.display_name, u.username) AS player_name,
    et.id AS team_registration_id,
    et.team_name,
    COUNT(DISTINCT COALESCE(m.id, m2.id, m3.id)) AS matches_played,
    SUM(mppv.minutes_played) AS minutes_played,
    
    -- Attack & Playmaking
    SUM(pms.goals) AS goals,
    SUM(pms.penalty_goals) AS penalty_goals,
    SUM(pms.assists) AS assists,
    SUM(pms.goals + pms.assists) AS goal_contributions,
    SUM(pms.shots) AS shots,
    SUM(pms.shots_on_target) AS shots_on_target,
    
    SUM(pms.passes_attempted) AS passes_attempted,
    SUM(pms.passes_completed) AS passes_completed,
    SUM(pms.key_passes) AS key_passes,
    SUM(pms.through_balls) AS through_balls,
    SUM(pms.crosses) AS crosses,
    
    SUM(pms.dribbles_attempted) AS dribbles_attempted,
    SUM(pms.successful_dribbles) AS successful_dribbles,
    SUM(pms.ankle_breakers) AS ankle_breakers,
    SUM(pms.nutmegs) AS nutmegs,
    SUM(pms.great_first_touches) AS great_first_touches,
    
    -- Defending
    SUM(pms.tackles_attempted) AS tackles_attempted,
    SUM(pms.tackles_won) AS tackles,
    SUM(pms.interceptions) AS interceptions,
    SUM(pms.recoveries) AS recoveries,
    SUM(pms.clearances) AS clearances,
    SUM(pms.blocks) AS blocks,
    SUM(pms.aerials_won) AS aerials_won,
    
    -- Goalkeeping
    SUM(pms.saves) AS saves,
    SUM(pms.penalty_saves) AS penalty_saves,
    SUM(pms.saves_1v1) AS saves_1v1,
    
    -- Discipline
    SUM(pms.fouls_committed) AS fouls_committed,
    SUM(pms.fouls_drawn) AS fouls_drawn,
    SUM(pms.yellow_cards) AS yellow_cards,
    SUM(pms.red_cards) AS red_cards,
    
    AVG(mppv.rating) AS average_rating
FROM event_team_players etp
JOIN users u ON etp.user_id = u.id
JOIN event_team_registrations et ON etp.event_registration_id = et.id

-- 1. Matches where they were in the lineup
LEFT JOIN match_lineup_players mlp ON etp.id = mlp.event_team_player_id
LEFT JOIN match_lineups ml ON mlp.lineup_id = ml.id
LEFT JOIN matches m ON ml.match_id = m.id AND m.match_state = 'COMPLETED'

-- 2. Matches where they had stats recorded directly
LEFT JOIN (
    player_match_stats_view pms 
    JOIN matches m2 ON pms.match_id = m2.id AND m2.match_state = 'COMPLETED'
) ON (pms.event_player_id = etp.id AND pms.match_id = m.id) OR (pms.event_player_id = etp.id AND mlp.id IS NULL)

-- 3. Ratings
LEFT JOIN (
    match_player_performance_view mppv
    JOIN matches m3 ON mppv.match_id = m3.id AND m3.match_state = 'COMPLETED'
) ON (mppv.player_id = etp.id AND mppv.match_id = m.id) OR (mppv.player_id = etp.id AND mlp.id IS NULL)

-- Ensure we only count matching events or fallback to raw stats if no lineup exists
WHERE m.event_id = et.event_id OR m2.event_id = et.event_id OR m3.event_id = et.event_id
GROUP BY et.event_id, etp.id, u.unique_code, u.display_name, u.username, et.id, et.team_name;

-- 6. Add rule for GREAT_FIRST_TOUCH in calculate_player_rating RPC
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

            -- DRIBBLE & GREAT FIRST TOUCH
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
            WHEN event_type = 'GREAT_FIRST_TOUCH' THEN 0.05

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
                CASE
                    WHEN metadata->>'result' = 'WON' THEN 0.05
                    WHEN metadata->>'result' = 'LOST' THEN -0.05
                    ELSE 0
                END

            -- SAVE
            WHEN event_type = 'SAVE' THEN
                0.1
                + CASE WHEN metadata->>'context' = 'PENALTY' THEN 0.4 ELSE 0 END
                + CASE WHEN metadata->>'context' = '1V1' THEN 0.2 ELSE 0 END

            ELSE 0
        END
    ), 0) INTO v_timeline_points
    FROM public.match_timeline_events
    WHERE match_id = p_match_id AND actor_player_id = p_player_id;

    -- Calculate referee points (penalties for fouls, cards)
    SELECT COALESCE(SUM(
        CASE
            WHEN event_type = 'FOUL' THEN -0.1
            WHEN event_type = 'YELLOW_CARD' THEN -0.5
            WHEN event_type = 'RED_CARD' THEN -1.5
            ELSE 0
        END
    ), 0) INTO v_referee_points
    FROM public.referee_events
    WHERE match_id = p_match_id AND event_player_id = p_player_id;

    v_rating := 6.0 + COALESCE(v_timeline_points, 0) + COALESCE(v_referee_points, 0);

    IF v_rating > 10.0 THEN v_rating := 10.0; END IF;
    IF v_rating < 1.0 THEN v_rating := 1.0; END IF;

    RETURN ROUND(v_rating, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
