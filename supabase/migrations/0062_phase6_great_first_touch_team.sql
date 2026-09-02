-- Phase 6: Great First Touch Feature - Team Stats
BEGIN;

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
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SAVE') AS saves,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'GREAT_FIRST_TOUCH') AS great_first_touches
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
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SAVE') AS saves,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'GREAT_FIRST_TOUCH') AS great_first_touches
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
    COALESCE(h.great_first_touches, 0) AS home_great_first_touches,
    COALESCE(a.great_first_touches, 0) AS away_great_first_touches,
    
    COALESCE(hr.fouls, 0) AS home_fouls,
    COALESCE(ar.fouls, 0) AS away_fouls,
    COALESCE(hr.yellow_cards, 0) AS home_yellow_cards,
    COALESCE(ar.yellow_cards, 0) AS away_yellow_cards,
    COALESCE(hr.red_cards, 0) AS home_red_cards,
    COALESCE(ar.red_cards, 0) AS away_red_cards

FROM public.matches m
LEFT JOIN home_stats h ON h.match_id = m.id
LEFT JOIN away_stats a ON a.match_id = m.id
LEFT JOIN home_referee hr ON hr.match_id = m.id
LEFT JOIN away_referee ar ON ar.match_id = m.id;

COMMIT;
