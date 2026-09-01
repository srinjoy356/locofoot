-- Migration 0046: Phase 5 Tournament KPIs and Form Views

BEGIN;

-- 1. TOURNAMENT KPIs VIEW
-- Aggregates total metrics for a tournament across all COMPLETED matches
CREATE OR REPLACE VIEW public.tournament_kpis_view AS
WITH completed_matches AS (
    SELECT id, event_id
    FROM public.matches
    WHERE match_state = 'COMPLETED'
),
match_stats AS (
    SELECT 
        m.event_id,
        COUNT(DISTINCT m.id) AS matches_played,
        COUNT(mte.id) FILTER (WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' = 'GOAL') AS total_goals,
        COUNT(mte.id) FILTER (WHERE mte.event_type = 'PASS' AND (mte.metadata->>'qualifier' = 'ASSIST' OR mte.metadata->>'assist' = 'true')) AS total_assists,
        COUNT(mte.id) FILTER (WHERE mte.event_type = 'SHOT') AS total_shots,
        COUNT(mte.id) FILTER (WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' IN ('GOAL', 'SAVED')) AS shots_on_target,
        COUNT(mte.id) FILTER (WHERE mte.event_type = 'SAVE') AS total_saves,
        COUNT(mte.id) FILTER (WHERE mte.event_type = 'DRIBBLE' AND mte.metadata->>'result' = 'SUCCESS') AS successful_dribbles
    FROM completed_matches m
    LEFT JOIN public.match_timeline_events mte ON mte.match_id = m.id
    GROUP BY m.event_id
),
referee_stats AS (
    SELECT
        m.event_id,
        COUNT(re.id) FILTER (WHERE re.event_type = 'FOUL') AS total_fouls,
        COUNT(re.id) FILTER (WHERE re.event_type = 'YELLOW_CARD') AS yellow_cards,
        COUNT(re.id) FILTER (WHERE re.event_type = 'RED_CARD') AS red_cards
    FROM completed_matches m
    LEFT JOIN public.referee_events re ON re.match_id = m.id
    GROUP BY m.event_id
)
SELECT 
    ms.event_id,
    ms.matches_played,
    ms.total_goals,
    CASE WHEN ms.matches_played > 0 THEN ROUND(ms.total_goals::numeric / ms.matches_played::numeric, 2) ELSE 0 END AS goals_per_match,
    ms.total_assists,
    ms.total_shots,
    ms.shots_on_target,
    COALESCE(rs.total_fouls, 0) AS total_fouls,
    COALESCE(rs.yellow_cards, 0) AS yellow_cards,
    COALESCE(rs.red_cards, 0) AS red_cards,
    ms.total_saves,
    ms.successful_dribbles
FROM match_stats ms
LEFT JOIN referee_stats rs ON rs.event_id = ms.event_id;

-- 2. TEAM FORM VIEW
-- Calculates the last 5 matches form (W/D/L) for each team in a tournament
CREATE OR REPLACE VIEW public.team_form_view AS
WITH match_results AS (
    SELECT
        m.event_id,
        m.id AS match_id,
        m.updated_at AS match_date,
        m.home_registration_id AS team_id,
        CASE 
            WHEN m.home_score > m.away_score THEN 'W' 
            WHEN m.home_score = m.away_score THEN 'D' 
            ELSE 'L' 
        END AS result
    FROM public.matches m
    WHERE m.match_state = 'COMPLETED'
    
    UNION ALL
    
    SELECT
        m.event_id,
        m.id AS match_id,
        m.updated_at AS match_date,
        m.away_registration_id AS team_id,
        CASE 
            WHEN m.away_score > m.home_score THEN 'W' 
            WHEN m.away_score = m.home_score THEN 'D' 
            ELSE 'L' 
        END AS result
    FROM public.matches m
    WHERE m.match_state = 'COMPLETED'
),
ranked_results AS (
    SELECT 
        event_id,
        team_id,
        result,
        match_date,
        ROW_NUMBER() OVER(PARTITION BY event_id, team_id ORDER BY match_date DESC) as match_rank
    FROM match_results
)
SELECT 
    event_id,
    team_id,
    ARRAY_AGG(result ORDER BY match_date ASC) AS form_last_5,
    COUNT(CASE WHEN result = 'W' THEN 1 END) AS wins_last_5,
    COUNT(CASE WHEN result = 'D' THEN 1 END) AS draws_last_5,
    COUNT(CASE WHEN result = 'L' THEN 1 END) AS losses_last_5
FROM ranked_results
WHERE match_rank <= 5
GROUP BY event_id, team_id;


-- 3. PLAYER FORM VIEW
-- Calculates the last 5 matches ratings for each player
CREATE OR REPLACE VIEW public.player_form_view AS
WITH ranked_ratings AS (
    SELECT 
        m.event_id,
        mpr.event_player_id,
        mpr.rating,
        m.updated_at AS match_date,
        ROW_NUMBER() OVER(PARTITION BY m.event_id, mpr.event_player_id ORDER BY m.updated_at DESC) as match_rank
    FROM public.match_player_ratings mpr
    JOIN public.matches m ON m.id = mpr.match_id
    WHERE m.match_state = 'COMPLETED'
)
SELECT 
    event_id,
    event_player_id,
    ARRAY_AGG(rating ORDER BY match_date ASC) AS ratings_last_5,
    ROUND(AVG(rating)::numeric, 2) AS avg_rating_last_5
FROM ranked_ratings
WHERE match_rank <= 5
GROUP BY event_id, event_player_id;

COMMIT;
