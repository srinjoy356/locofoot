-- Phase 5F: Security Hardening, Key Pass Alignment, and Penalties
BEGIN;

-- 1. Security Hardening for Score Recalculation
-- Set safe search_path and revoke public execution
ALTER FUNCTION public.recalculate_match_score(UUID) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.recalculate_match_score(UUID) FROM PUBLIC;

-- Ensure trigger can still run it (triggers run as the table owner or definer)
-- The function is SECURITY DEFINER, so it runs with privileges of the user who defined it.

-- 2. Key Pass Relational Alignment
-- Recreate the player_match_stats_view to derive key_passes relationally
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
        -- Relational Key Pass: A completed pass where the immediately following event by the same team is a shot on target (GOAL or SAVED).
        COUNT(*) FILTER (WHERE event_type = 'PASS' AND metadata->>'result' = 'COMPLETED' AND next_team_event_type = 'SHOT' AND next_team_event_result IN ('GOAL', 'SAVED')) AS key_passes,
        
        -- Dribbling
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE') AS dribbles_attempted,
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE' AND metadata->>'result' = 'SUCCESS') AS successful_dribbles,
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE' AND (metadata->>'opponents_beaten')::int >= 2) AS ankle_breakers,
        COUNT(*) FILTER (WHERE event_type = 'DRIBBLE' AND is_nutmeg = true) AS nutmegs,
        
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

-- Recreate any views that depend on player_match_stats_view (if any)
-- tournament_playmaking_stats_view depends on it:
DROP VIEW IF EXISTS public.tournament_playmaking_stats_view CASCADE;
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
    SUM(pms.through_balls) AS total_through_balls
FROM public.player_match_stats_view pms
JOIN public.matches m ON pms.match_id = m.id
WHERE m.match_state = 'COMPLETED'
GROUP BY m.event_id, pms.event_player_id;

COMMIT;
