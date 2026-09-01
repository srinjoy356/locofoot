-- Drop the old view if it exists
DROP VIEW IF EXISTS public.match_player_performance_view;

CREATE OR REPLACE VIEW public.match_player_performance_view AS
SELECT 
    mp.match_id,
    mp.event_player_id AS player_id,
    COALESCE(u.display_name, u.username, 'Unknown Player') AS player_name,
    mp.event_registration_id AS registration_id,
    mp.status,
    COALESCE(ROUND((mp.exit_elapsed_seconds - mp.entry_elapsed_seconds)::numeric / 60, 0), 0) AS minutes_played,
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
    mpr.rating,
    mpr.is_potm AS is_mvp
FROM public.match_participation mp
LEFT JOIN public.event_team_players etp ON etp.id = mp.event_player_id
LEFT JOIN public.users u ON u.id = etp.user_id
LEFT JOIN public.player_match_stats_view pms ON pms.match_id = mp.match_id AND pms.event_player_id = mp.event_player_id
LEFT JOIN public.match_player_ratings mpr ON mpr.match_id = mp.match_id AND mpr.event_player_id = mp.event_player_id;
