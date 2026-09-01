-- Phase 5C: Advanced Tournament Analytics

BEGIN;

-- 1. MATCH GOAL CHRONOLOGY VIEW
-- Tracks the score at the time of each goal to determine game-winning goals and equalizers
DROP VIEW IF EXISTS public.match_goal_chronology_view CASCADE;

CREATE OR REPLACE VIEW public.match_goal_chronology_view AS
WITH goals AS (
    SELECT 
        mte.id AS event_id,
        mte.match_id,
        m.event_id AS tournament_id,
        mte.elapsed_seconds,
        mte.actor_registration_id AS scoring_team_id,
        mte.actor_player_id AS scorer_player_id,
        m.home_registration_id,
        m.away_registration_id,
        m.home_score AS final_home_score,
        m.away_score AS final_away_score,
        CASE WHEN mte.actor_registration_id = m.home_registration_id THEN 1 ELSE 0 END as is_home_goal,
        CASE WHEN mte.actor_registration_id = m.away_registration_id THEN 1 ELSE 0 END as is_away_goal,
        CASE 
            WHEN m.home_score > m.away_score THEN m.home_registration_id 
            WHEN m.away_score > m.home_score THEN m.away_registration_id 
            ELSE NULL 
        END AS winning_team_id
    FROM public.match_timeline_events mte
    JOIN public.matches m ON mte.match_id = m.id
    WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' = 'GOAL' AND m.match_state = 'COMPLETED'
),
running_scores AS (
    SELECT 
        g.*,
        SUM(is_home_goal) OVER (PARTITION BY match_id ORDER BY elapsed_seconds, event_id) AS home_score_at_time,
        SUM(is_away_goal) OVER (PARTITION BY match_id ORDER BY elapsed_seconds, event_id) AS away_score_at_time
    FROM goals g
),
score_states AS (
    SELECT 
        rs.*,
        COALESCE(LAG(home_score_at_time, 1) OVER (PARTITION BY match_id ORDER BY elapsed_seconds, event_id), 0) AS home_score_before,
        COALESCE(LAG(away_score_at_time, 1) OVER (PARTITION BY match_id ORDER BY elapsed_seconds, event_id), 0) AS away_score_before
    FROM running_scores rs
)
SELECT 
    *,
    
    -- Equalizer: Before this goal, the score was unequal. After, it is equal.
    CASE WHEN home_score_before != away_score_before AND home_score_at_time = away_score_at_time THEN true ELSE false END AS is_equalizer,
    
    -- GWG: The goal that put the winning team ahead for good.
    -- For Home Win: Home goal where home_score_at_time = final_away_score + 1
    -- For Away Win: Away goal where away_score_at_time = final_home_score + 1
    CASE 
        WHEN winning_team_id = home_registration_id AND is_home_goal = 1 AND home_score_at_time = final_away_score + 1 THEN true
        WHEN winning_team_id = away_registration_id AND is_away_goal = 1 AND away_score_at_time = final_home_score + 1 THEN true
        ELSE false
    END AS is_gwg,
    
    -- Late Goal: We'll assume a standard match length approximation (e.g. 80th min = 4800s)
    -- This relies on `elapsed_seconds >= 4800`.
    CASE WHEN elapsed_seconds >= 4800 THEN true ELSE false END AS is_late_goal

FROM score_states;


-- 2. TOURNAMENT CLUTCH PLAYER STATS VIEW
-- Aggregates Clutch Metrics per player
DROP VIEW IF EXISTS public.tournament_clutch_player_stats_view CASCADE;

CREATE OR REPLACE VIEW public.tournament_clutch_player_stats_view AS
SELECT
    tournament_id,
    scorer_player_id AS event_player_id,
    COUNT(event_id) AS total_goals,
    COUNT(*) FILTER (WHERE is_gwg) AS gwg,
    COUNT(*) FILTER (WHERE is_equalizer) AS equalizers,
    COUNT(*) FILTER (WHERE is_late_goal) AS late_goals
FROM public.match_goal_chronology_view
WHERE scorer_player_id IS NOT NULL
GROUP BY tournament_id, scorer_player_id;


-- 3. TOURNAMENT COMEBACK TEAM STATS VIEW
-- Calculates Comebacks per team
DROP VIEW IF EXISTS public.tournament_comeback_team_stats_view CASCADE;

CREATE OR REPLACE VIEW public.tournament_comeback_team_stats_view AS
WITH match_deficits AS (
    SELECT 
        match_id,
        tournament_id,
        winning_team_id,
        home_registration_id,
        away_registration_id,
        final_home_score,
        final_away_score,
        -- Did home fall behind at any point?
        BOOL_OR(away_score_at_time > home_score_at_time OR (is_away_goal = 1 AND away_score_at_time > home_score_before)) AS home_fell_behind,
        -- Did away fall behind at any point?
        BOOL_OR(home_score_at_time > away_score_at_time OR (is_home_goal = 1 AND home_score_at_time > away_score_before)) AS away_fell_behind
    FROM public.match_goal_chronology_view
    GROUP BY match_id, tournament_id, winning_team_id, home_registration_id, away_registration_id, final_home_score, final_away_score
),
comeback_flags AS (
    -- Home teams
    SELECT 
        tournament_id,
        home_registration_id AS team_id,
        match_id,
        CASE WHEN home_fell_behind THEN 1 ELSE 0 END AS fell_behind,
        CASE WHEN home_fell_behind AND winning_team_id = home_registration_id THEN 1 ELSE 0 END AS comeback_win,
        CASE WHEN home_fell_behind AND final_home_score = final_away_score THEN 1 ELSE 0 END AS comeback_draw
    FROM match_deficits
    
    UNION ALL
    
    -- Away teams
    SELECT 
        tournament_id,
        away_registration_id AS team_id,
        match_id,
        CASE WHEN away_fell_behind THEN 1 ELSE 0 END AS fell_behind,
        CASE WHEN away_fell_behind AND winning_team_id = away_registration_id THEN 1 ELSE 0 END AS comeback_win,
        CASE WHEN away_fell_behind AND final_home_score = final_away_score THEN 1 ELSE 0 END AS comeback_draw
    FROM match_deficits
)
SELECT 
    tournament_id,
    team_id,
    SUM(fell_behind) AS times_fell_behind,
    SUM(comeback_win) AS comeback_wins,
    SUM(comeback_draw) AS comeback_draws,
    SUM(comeback_win + comeback_draw) AS total_comebacks
FROM comeback_flags
GROUP BY tournament_id, team_id;


-- 4. TOURNAMENT RECORDS VIEW
-- Provides high-level extremes
DROP VIEW IF EXISTS public.tournament_records_view CASCADE;

CREATE OR REPLACE VIEW public.tournament_records_view AS
WITH all_matches AS (
    SELECT 
        m.id AS match_id,
        m.event_id AS tournament_id,
        m.home_registration_id,
        m.away_registration_id,
        m.home_score,
        m.away_score,
        m.home_score + m.away_score AS total_goals,
        ABS(m.home_score - m.away_score) AS goal_margin,
        GREATEST(m.home_score, m.away_score) AS max_team_goals
    FROM public.matches m
    WHERE m.match_state = 'COMPLETED'
)
SELECT 
    tournament_id,
    MAX(total_goals) AS highest_scoring_match,
    MAX(goal_margin) AS biggest_win_margin,
    MAX(max_team_goals) AS most_goals_by_one_team,
    MAX(CASE WHEN home_score = away_score THEN total_goals ELSE 0 END) AS highest_scoring_draw
FROM all_matches
GROUP BY tournament_id;

-- 5. TOURNAMENT TRENDS VIEW
-- Note: Matchday grouping proxy by Date
DROP VIEW IF EXISTS public.tournament_trends_view CASCADE;

CREATE OR REPLACE VIEW public.tournament_trends_view AS
SELECT 
    m.event_id AS tournament_id,
    DATE(COALESCE(m.scheduled_start, m.created_at)) AS match_date,
    COUNT(DISTINCT m.id) AS matches_played,
    SUM(m.home_score + m.away_score) AS total_goals
FROM public.matches m
WHERE m.match_state = 'COMPLETED'
GROUP BY m.event_id, DATE(COALESCE(m.scheduled_start, m.created_at));


-- Grant Access
GRANT SELECT ON public.match_goal_chronology_view TO authenticated, anon;
GRANT SELECT ON public.tournament_clutch_player_stats_view TO authenticated, anon;
GRANT SELECT ON public.tournament_comeback_team_stats_view TO authenticated, anon;
GRANT SELECT ON public.tournament_records_view TO authenticated, anon;
GRANT SELECT ON public.tournament_trends_view TO authenticated, anon;

COMMIT;
