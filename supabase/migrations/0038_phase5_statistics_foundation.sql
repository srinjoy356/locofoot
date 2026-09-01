-- Phase 5: Statistics & Leaderboards Foundation
-- Adds missing profile fields, fixes timeline relations, and creates statistical views

BEGIN;

-- 1. PROFILES (WEAK FOOT)
-- Rename strong_foot to dominant_foot if it exists and add weak_foot
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'strong_foot') THEN
        ALTER TABLE public.users RENAME COLUMN strong_foot TO dominant_foot;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'dominant_foot') THEN
        ALTER TABLE public.users ADD COLUMN dominant_foot text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'weak_foot') THEN
        ALTER TABLE public.users ADD COLUMN weak_foot text;
    END IF;
END $$;

-- 2. EXPLICIT BIG CHANCE CREATOR
-- Adds an explicit link to the creator of a big chance on the timeline
ALTER TABLE public.match_timeline_events 
    ADD COLUMN IF NOT EXISTS big_chance_creator_player_id UUID REFERENCES public.event_team_players(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS big_chance_creator_event_id UUID REFERENCES public.match_timeline_events(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_nutmeg BOOLEAN DEFAULT false;

-- 3. TOURNAMENT STANDINGS VIEW
-- A dynamic view that computes tournament standings based strictly on completed matches
-- Uses a simplified 3/1/0 rule internally for the view, but the actual FastAPI route
-- will apply the event_settings multiplier (points_win, points_draw).
CREATE OR REPLACE VIEW public.tournament_standings_view AS
WITH match_results AS (
    SELECT
        m.event_id,
        m.id AS match_id,
        m.home_registration_id AS team_id,
        m.home_score AS goals_for,
        m.away_score AS goals_against,
        CASE WHEN m.home_score > m.away_score THEN 1 ELSE 0 END AS win,
        CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS draw,
        CASE WHEN m.home_score < m.away_score THEN 1 ELSE 0 END AS loss
    FROM public.matches m
    WHERE m.match_state = 'COMPLETED'
    
    UNION ALL
    
    SELECT
        m.event_id,
        m.id AS match_id,
        m.away_registration_id AS team_id,
        m.away_score AS goals_for,
        m.home_score AS goals_against,
        CASE WHEN m.away_score > m.home_score THEN 1 ELSE 0 END AS win,
        CASE WHEN m.away_score = m.home_score THEN 1 ELSE 0 END AS draw,
        CASE WHEN m.away_score < m.home_score THEN 1 ELSE 0 END AS loss
    FROM public.matches m
    WHERE m.match_state = 'COMPLETED'
)
SELECT 
    event_id,
    team_id,
    COUNT(match_id) AS matches_played,
    SUM(win) AS wins,
    SUM(draw) AS draws,
    SUM(loss) AS losses,
    SUM(goals_for) AS goals_for,
    SUM(goals_against) AS goals_against,
    SUM(goals_for) - SUM(goals_against) AS goal_difference,
    (SUM(win) * 3) + (SUM(draw) * 1) AS points -- Default 3/1/0 points, can be overridden in API
FROM match_results
GROUP BY event_id, team_id;


-- 4. PLAYER MATCH STATS VIEW (EXTENDED)
-- Completely strict derivation of all requested statistics
DROP VIEW IF EXISTS public.player_match_stats_view CASCADE;

CREATE OR REPLACE VIEW public.player_match_stats_view AS
WITH timeline_aggs AS (
    SELECT 
        mte.match_id,
        mte.actor_player_id AS event_player_id,
        COUNT(*) FILTER (WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' = 'GOAL') AS goals,
        COUNT(*) FILTER (WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' = 'GOAL' AND mte.metadata->>'situation' = 'PENALTY') AS penalty_goals,
        COUNT(*) FILTER (WHERE mte.event_type = 'SHOT') AS shots,
        COUNT(*) FILTER (WHERE mte.event_type = 'SHOT' AND mte.metadata->>'result' IN ('GOAL', 'SAVED')) AS shots_on_target,
        
        -- Passes
        COUNT(*) FILTER (WHERE mte.event_type = 'PASS') AS passes_attempted,
        COUNT(*) FILTER (WHERE mte.event_type = 'PASS' AND mte.metadata->>'result' = 'COMPLETED') AS passes_completed,
        COUNT(*) FILTER (WHERE mte.event_type = 'PASS' AND mte.metadata->>'type' = 'THROUGH_BALL' AND mte.metadata->>'result' = 'COMPLETED') AS through_balls,
        COUNT(*) FILTER (WHERE mte.event_type = 'PASS' AND mte.metadata->>'type' = 'CROSS' AND mte.metadata->>'result' = 'COMPLETED') AS crosses,
        
        -- Key Passes & Assists (assuming qualifier='KEY_PASS' or 'ASSIST')
        COUNT(*) FILTER (WHERE mte.event_type = 'PASS' AND (mte.metadata->>'qualifier' = 'ASSIST' OR mte.metadata->>'assist' = 'true')) AS assists,
        COUNT(*) FILTER (WHERE mte.event_type = 'PASS' AND mte.metadata->>'qualifier' = 'KEY_PASS') AS key_passes,
        
        -- Dribbling
        COUNT(*) FILTER (WHERE mte.event_type = 'DRIBBLE') AS dribbles_attempted,
        COUNT(*) FILTER (WHERE mte.event_type = 'DRIBBLE' AND mte.metadata->>'result' = 'SUCCESS') AS successful_dribbles,
        COUNT(*) FILTER (WHERE mte.event_type = 'DRIBBLE' AND (mte.metadata->>'opponents_beaten')::int >= 2) AS ankle_breakers,
        COUNT(*) FILTER (WHERE mte.event_type = 'DRIBBLE' AND mte.is_nutmeg = true) AS nutmegs,
        
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
        COUNT(*) FILTER (WHERE mte.event_type = 'SAVE' AND mte.metadata->>'context' = '1V1') AS saves_1v1
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


-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_match_timeline_events_match_actor ON public.match_timeline_events(match_id, actor_player_id);
CREATE INDEX IF NOT EXISTS idx_match_timeline_events_type_result ON public.match_timeline_events(event_type, (metadata->>'result'));
CREATE INDEX IF NOT EXISTS idx_referee_events_match_player ON public.referee_events(match_id, event_player_id);
CREATE INDEX IF NOT EXISTS idx_referee_events_target ON public.referee_events(match_id, target_player_id);
CREATE INDEX IF NOT EXISTS idx_match_participation_match_player ON public.match_participation(match_id, event_player_id);
CREATE INDEX IF NOT EXISTS idx_match_player_ratings_potm ON public.match_player_ratings(match_id, is_potm);
CREATE INDEX IF NOT EXISTS idx_matches_state_completed ON public.matches(event_id, match_state);

COMMIT;
