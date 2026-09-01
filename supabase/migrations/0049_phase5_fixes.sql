-- Fix match_statistics_overview_view to correctly count passes and tackles
DROP VIEW IF EXISTS public.match_statistics_overview_view CASCADE;
CREATE OR REPLACE VIEW public.match_statistics_overview_view AS
WITH match_info AS (
    SELECT id, home_registration_id, away_registration_id
    FROM public.matches
),
home_stats AS (
    SELECT 
        m.id AS match_id,
        m.home_registration_id AS team_id,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' = 'GOAL') AS goals,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT') AS shots,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' IN ('GOAL', 'SAVED')) AS shots_on_target,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS') AS passes,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS' AND mte.metadata->>'result' = 'COMPLETED') AS completed_passes,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'DRIBBLE' AND mte.metadata->>'result' = 'SUCCESS') AS successful_dribbles,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'TACKLE' AND mte.metadata->>'result' IN ('WON_RETAINED', 'WON_LOOSE')) AS tackles_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'INTERCEPTION') AS interceptions,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BALL_RECOVERY') AS recoveries,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'CLEARANCE') AS clearances,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BLOCK') AS blocks,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'AERIAL_DUEL' AND mte.metadata->>'result' = 'SUCCESS') AS aerial_duels_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SAVE') AS saves
    FROM match_info m
    LEFT JOIN public.match_timeline_events mte ON mte.match_id = m.id AND mte.actor_registration_id = m.home_registration_id
    GROUP BY m.id, m.home_registration_id
),
away_stats AS (
    SELECT 
        m.id AS match_id,
        m.away_registration_id AS team_id,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' = 'GOAL') AS goals,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT') AS shots,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SHOT' AND mte.metadata->>'result' IN ('GOAL', 'SAVED')) AS shots_on_target,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS') AS passes,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'PASS' AND mte.metadata->>'result' = 'COMPLETED') AS completed_passes,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'DRIBBLE' AND mte.metadata->>'result' = 'SUCCESS') AS successful_dribbles,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'TACKLE' AND mte.metadata->>'result' IN ('WON_RETAINED', 'WON_LOOSE')) AS tackles_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'INTERCEPTION') AS interceptions,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BALL_RECOVERY') AS recoveries,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'CLEARANCE') AS clearances,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'BLOCK') AS blocks,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'AERIAL_DUEL' AND mte.metadata->>'result' = 'SUCCESS') AS aerial_duels_won,
        COUNT(mte.id) FILTER (WHERE mte.event_type::text = 'SAVE') AS saves
    FROM match_info m
    LEFT JOIN public.match_timeline_events mte ON mte.match_id = m.id AND mte.actor_registration_id = m.away_registration_id
    GROUP BY m.id, m.away_registration_id
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
    h.shots AS home_shots,
    h.shots_on_target AS home_shots_on_target,
    h.passes AS home_passes,
    h.completed_passes AS home_completed_passes,
    CASE WHEN h.passes > 0 THEN ROUND((h.completed_passes::numeric / h.passes::numeric) * 100, 1) ELSE 0 END AS home_pass_accuracy_percent,
    h.successful_dribbles AS home_successful_dribbles,
    h.tackles_won AS home_tackles_won,
    h.interceptions AS home_interceptions,
    h.recoveries AS home_recoveries,
    h.clearances AS home_clearances,
    h.blocks AS home_blocks,
    h.aerial_duels_won AS home_aerial_duels_won,
    COALESCE(hr.fouls, 0) AS home_fouls,
    COALESCE(hr.yellow_cards, 0) AS home_yellow_cards,
    COALESCE(hr.red_cards, 0) AS home_red_cards,
    h.saves AS home_saves,
    
    a.shots AS away_shots,
    a.shots_on_target AS away_shots_on_target,
    a.passes AS away_passes,
    a.completed_passes AS away_completed_passes,
    CASE WHEN a.passes > 0 THEN ROUND((a.completed_passes::numeric / a.passes::numeric) * 100, 1) ELSE 0 END AS away_pass_accuracy_percent,
    a.successful_dribbles AS away_successful_dribbles,
    a.tackles_won AS away_tackles_won,
    a.interceptions AS away_interceptions,
    a.recoveries AS away_recoveries,
    a.clearances AS away_clearances,
    a.blocks AS away_blocks,
    a.aerial_duels_won AS away_aerial_duels_won,
    COALESCE(ar.fouls, 0) AS away_fouls,
    COALESCE(ar.yellow_cards, 0) AS away_yellow_cards,
    COALESCE(ar.red_cards, 0) AS away_red_cards,
    a.saves AS away_saves
FROM match_info m
LEFT JOIN home_stats h ON h.match_id = m.id
LEFT JOIN away_stats a ON a.match_id = m.id
LEFT JOIN home_referee hr ON hr.match_id = m.id
LEFT JOIN away_referee ar ON ar.match_id = m.id;

-- Fix match_player_performance_view to use full outer join
DROP VIEW IF EXISTS public.match_player_performance_view CASCADE;
CREATE OR REPLACE VIEW public.match_player_performance_view AS
SELECT 
    COALESCE(mp.match_id, pms.match_id, pds.match_id) AS match_id,
    COALESCE(mp.event_player_id, pms.event_player_id, pds.event_player_id) AS player_id,
    COALESCE(u.display_name, u.username, 'Unknown Player') AS player_name,
    COALESCE(mp.event_registration_id, etp.event_registration_id) AS registration_id,
    COALESCE(mp.status, 'STARTER'::public.participation_status) AS status,
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
