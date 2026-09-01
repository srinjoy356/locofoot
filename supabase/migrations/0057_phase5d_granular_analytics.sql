-- ==============================================================================
-- LOCOFOOT — PHASE 5D: GRANULAR EVENT-LEVEL ANALYTICS
-- Focus: Shot maps, advanced playmaking, sweeper actions, granular aggregations
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. SHOT MAP VIEW
-- ==============================================================================
-- This view provides normalized shot coordinates for spatial visualization.
-- It projects all shots so that the attacking goal is at y=0.

CREATE OR REPLACE VIEW public.tournament_shot_map_view AS
SELECT 
    mte.id AS event_id,
    mte.match_id,
    m.event_id AS tournament_id,
    mte.actor_player_id AS player_id,
    mte.actor_registration_id AS team_id,
    mte.period,
    mte.display_minute,
    mte.metadata->>'result' AS result,
    mte.metadata->>'type' AS shot_type,
    mte.metadata->>'situation' AS situation,
    
    -- Normalize coordinates:
    -- If the team is Home, they attack towards y=0.
    -- If the team is Away, they attack towards y=100.
    -- To make all teams attack towards y=0 on the visualization:
    -- Home: x, y
    -- Away: 100-x, 100-y
    CASE 
        WHEN etp.event_registration_id = m.home_registration_id THEN mte.x
        ELSE 100 - mte.x
    END AS x_norm,
    CASE 
        WHEN etp.event_registration_id = m.home_registration_id THEN mte.y
        ELSE 100 - mte.y
    END AS y_norm,
    
    -- Euclidean distance from the center of the attacking goal (x=50, y=0)
    SQRT(
        POWER(
            50 - CASE 
                WHEN etp.event_registration_id = m.home_registration_id THEN mte.x
                ELSE 100 - mte.x
            END, 2
        ) + 
        POWER(
            0 - CASE 
                WHEN etp.event_registration_id = m.home_registration_id THEN mte.y
                ELSE 100 - mte.y
            END, 2
        )
    ) AS distance

FROM public.match_timeline_events mte
JOIN public.matches m ON mte.match_id = m.id
JOIN public.event_team_players etp ON mte.actor_player_id = etp.id
WHERE mte.event_type = 'SHOT' 
  AND m.match_state = 'COMPLETED'
  AND mte.x IS NOT NULL 
  AND mte.y IS NOT NULL;

GRANT SELECT ON public.tournament_shot_map_view TO authenticated, anon;


-- ==============================================================================
-- 2. ENHANCED PLAYER MATCH STATS VIEW
-- ==============================================================================
-- Adding missing granular aggregations like Big Chances Created, Aerial Claims,
-- Sweeper Actions, and Nutmegs explicitly.

DROP VIEW IF EXISTS public.tournament_player_stats_view CASCADE;
DROP VIEW IF EXISTS public.player_match_stats_view CASCADE;

CREATE OR REPLACE VIEW public.player_match_stats_view AS
WITH timeline_aggs AS (
    SELECT 
        mte.match_id,
        mte.actor_player_id AS event_player_id,
        
        -- Attack
        COUNT(*) FILTER (WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' = 'GOAL') AS goals,
        COUNT(*) FILTER (WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' = 'GOAL' AND mte.metadata->>'situation' = 'PENALTY') AS penalty_goals,
        COUNT(*) FILTER (WHERE mte.event_type = 'SHOT') AS shots,
        COUNT(*) FILTER (WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' IN ('GOAL', 'SAVED')) AS shots_on_target,
        
        -- Passes
        COUNT(*) FILTER (WHERE mte.event_type = 'PASS') AS passes_attempted,
        COUNT(*) FILTER (WHERE mte.event_type = 'PASS' AND mte.metadata->>'result' = 'COMPLETED') AS passes_completed,
        COUNT(*) FILTER (WHERE mte.event_type = 'PASS' AND mte.metadata->>'type' = 'THROUGH_BALL' AND mte.metadata->>'result' = 'COMPLETED') AS through_balls,
        COUNT(*) FILTER (WHERE mte.event_type = 'CROSS' AND mte.metadata->>'result' = 'COMPLETED') AS crosses,
        
        -- Key Passes & Assists
        COUNT(*) FILTER (WHERE mte.event_type = 'PASS' AND (mte.metadata->>'qualifier' = 'ASSIST' OR mte.metadata->>'assist' = 'true')) AS assists,
        COUNT(*) FILTER (WHERE mte.event_type = 'PASS' AND mte.metadata->>'qualifier' = 'KEY_PASS') AS key_passes,
        
        -- Dribbling
        COUNT(*) FILTER (WHERE mte.event_type = 'DRIBBLE') AS dribbles_attempted,
        COUNT(*) FILTER (WHERE mte.event_type = 'DRIBBLE' AND mte.metadata->>'result' = 'SUCCESS') AS successful_dribbles,
        COUNT(*) FILTER (WHERE mte.event_type = 'DRIBBLE' AND mte.metadata->>'opponentsBeaten' IN ('2', '3+')) AS ankle_breakers,
        COUNT(*) FILTER (WHERE mte.event_type = 'DRIBBLE' AND mte.metadata->>'skillType' = 'NUTMEG') AS nutmegs,
        
        -- Defending
        COUNT(*) FILTER (WHERE mte.event_type = 'TACKLE') AS tackles_attempted,
        COUNT(*) FILTER (WHERE mte.event_type = 'TACKLE' AND mte.metadata->>'result' IN ('WON_RETAINED', 'WON_LOOSE')) AS tackles_won,
        COUNT(*) FILTER (WHERE mte.event_type = 'INTERCEPTION') AS interceptions,
        COUNT(*) FILTER (WHERE mte.event_type = 'BALL_RECOVERY') AS recoveries,
        COUNT(*) FILTER (WHERE mte.event_type = 'CLEARANCE') AS clearances,
        COUNT(*) FILTER (WHERE mte.event_type = 'BLOCK') AS blocks,
        COUNT(*) FILTER (WHERE mte.event_type = 'AERIAL_DUEL' AND mte.metadata->>'result' = 'WON') AS aerials_won,
        
        -- Goalkeeping
        COUNT(*) FILTER (WHERE mte.event_type = 'SAVE') AS saves,
        COUNT(*) FILTER (WHERE mte.event_type = 'SAVE' AND mte.metadata->>'context' = 'PENALTY') AS penalty_saves,
        COUNT(*) FILTER (WHERE mte.event_type = 'SAVE' AND mte.metadata->>'context' = '1V1') AS saves_1v1,
        COUNT(*) FILTER (WHERE mte.event_type = 'AERIAL_CLAIM') AS aerial_claims,
        COUNT(*) FILTER (WHERE mte.event_type = 'SWEEPER_ACTION') AS sweeper_actions

    FROM public.match_timeline_events mte
    WHERE mte.actor_player_id IS NOT NULL
    GROUP BY mte.match_id, mte.actor_player_id
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
),
big_chance_aggs AS (
    SELECT
        mte.match_id,
        mte.big_chance_creator_player_id AS event_player_id,
        COUNT(*) AS big_chances_created
    FROM public.match_timeline_events mte
    WHERE mte.big_chance_creator_player_id IS NOT NULL
    GROUP BY mte.match_id, mte.big_chance_creator_player_id
)
SELECT 
    COALESCE(t.match_id, r.match_id, fd.match_id, bc.match_id) AS match_id,
    COALESCE(t.event_player_id, r.event_player_id, fd.event_player_id, bc.event_player_id) AS event_player_id,
    
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
    COALESCE(bc.big_chances_created, 0) AS big_chances_created,
    
    COALESCE(t.dribbles_attempted, 0) AS dribbles_attempted,
    COALESCE(t.successful_dribbles, 0) AS successful_dribbles,
    COALESCE(t.ankle_breakers, 0) AS ankle_breakers,
    COALESCE(t.nutmegs, 0) AS nutmegs,
    
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
    COALESCE(t.aerial_claims, 0) AS aerial_claims,
    COALESCE(t.sweeper_actions, 0) AS sweeper_actions,
    
    COALESCE(r.fouls_committed, 0) AS fouls_committed,
    COALESCE(fd.fouls_drawn, 0) AS fouls_drawn,
    COALESCE(r.yellow_cards, 0) AS yellow_cards,
    COALESCE(r.red_cards, 0) AS red_cards

FROM timeline_aggs t
FULL OUTER JOIN referee_aggs r ON t.match_id = r.match_id AND t.event_player_id = r.event_player_id
FULL OUTER JOIN fouls_drawn_aggs fd ON COALESCE(t.match_id, r.match_id) = fd.match_id AND COALESCE(t.event_player_id, r.event_player_id) = fd.event_player_id
FULL OUTER JOIN big_chance_aggs bc ON COALESCE(t.match_id, r.match_id, fd.match_id) = bc.match_id AND COALESCE(t.event_player_id, r.event_player_id, fd.event_player_id) = bc.event_player_id;


-- ==============================================================================
-- 3. ENHANCED TOURNAMENT PLAYER STATS VIEW
-- ==============================================================================

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

CREATE OR REPLACE VIEW public.tournament_player_stats_view AS
SELECT 
    et.event_id,
    etp.id AS event_player_id,
    u.unique_code AS player_unique_code,
    COALESCE(u.display_name, u.username) AS player_name,
    et.id AS team_registration_id,
    et.team_name,
    COUNT(DISTINCT m.id) AS matches_played,
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
    SUM(pms.big_chances_created) AS big_chances_created,
    
    SUM(pms.dribbles_attempted) AS dribbles_attempted,
    SUM(pms.successful_dribbles) AS successful_dribbles,
    SUM(pms.ankle_breakers) AS ankle_breakers,
    SUM(pms.nutmegs) AS nutmegs,
    
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
    SUM(pms.aerial_claims) AS aerial_claims,
    SUM(pms.sweeper_actions) AS sweeper_actions,
    
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

COMMIT;
