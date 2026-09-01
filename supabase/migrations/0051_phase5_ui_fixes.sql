BEGIN;

DROP VIEW IF EXISTS public.match_player_performance_view CASCADE;
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

COMMIT;
