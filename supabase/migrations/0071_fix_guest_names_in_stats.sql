BEGIN;

-- 1. Fix get_leaderboard RPC to include guests and use guest_name
CREATE OR REPLACE FUNCTION public.get_leaderboard(
    p_metric TEXT,
    p_scope TEXT,
    p_event_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    event_player_id UUID,
    player_name TEXT,
    team_name TEXT,
    team_registration_id UUID,
    matches_played INT,
    minutes_played INT,
    value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH player_aggs AS (
        SELECT 
            pms.event_player_id,
            etr.team_name,
            etp.event_registration_id AS team_registration_id,
            COUNT(DISTINCT pms.match_id) AS matches_played,
            COALESCE(SUM(mp.minutes_played), 0)::INT AS minutes_played,
            SUM(
                CASE 
                    WHEN p_metric = 'golden-boot' THEN pms.goals
                    WHEN p_metric = 'playmaker' THEN pms.assists
                    WHEN p_metric = 'goal-contributions' THEN pms.goals + pms.assists
                    WHEN p_metric = 'pass-accuracy' THEN 
                        CASE WHEN (pms.passes_attempted) > 0 THEN (pms.passes_completed::numeric / pms.passes_attempted) * 100 ELSE 0 END
                    WHEN p_metric = 'dribble-success' THEN 
                        CASE WHEN (pms.dribbles_attempted) > 0 THEN (pms.successful_dribbles::numeric / pms.dribbles_attempted) * 100 ELSE 0 END
                    WHEN p_metric = 'tackle-masters' THEN pms.tackles_won
                    WHEN p_metric = 'interceptions' THEN pms.interceptions
                    WHEN p_metric = 'recoveries' THEN pms.recoveries
                    WHEN p_metric = 'saves' THEN pms.saves
                    WHEN p_metric = 'yellow-cards' THEN pms.yellow_cards
                    WHEN p_metric = 'red-cards' THEN pms.red_cards
                    ELSE 0
                END
            ) AS metric_value,
            
            -- Secondary tie breaks
            SUM(CASE WHEN p_metric = 'golden-boot' THEN pms.penalty_goals ELSE 0 END) AS tie_break_1
        FROM public.player_match_stats_view pms
        JOIN public.matches m ON m.id = pms.match_id
        JOIN public.event_team_players etp ON etp.id = pms.event_player_id
        JOIN public.event_team_registrations etr ON etr.id = etp.event_registration_id
        LEFT JOIN public.match_participation mp ON mp.match_id = pms.match_id AND mp.event_player_id = pms.event_player_id
        WHERE m.match_state = 'COMPLETED'
          AND (p_scope != 'event' OR m.event_id = p_event_id)
        GROUP BY pms.event_player_id, etr.team_name, etp.event_registration_id
    )
    SELECT 
        pa.event_player_id,
        COALESCE(u.display_name, u.username, etp.guest_name, 'Unknown Player')::TEXT AS player_name,
        pa.team_name::TEXT,
        pa.team_registration_id,
        pa.matches_played::INT,
        pa.minutes_played::INT,
        pa.metric_value::NUMERIC AS value
    FROM player_aggs pa
    JOIN public.event_team_players etp ON etp.id = pa.event_player_id
    LEFT JOIN public.users u ON u.id = etp.user_id
    WHERE pa.metric_value > 0
    ORDER BY 
        pa.metric_value DESC, 
        -- specific tie breaks
        CASE WHEN p_metric = 'golden-boot' THEN pa.tie_break_1 END ASC, -- Penalty goals ASC
        pa.minutes_played ASC -- General efficiency tie break
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 2. Update match_player_performance_view to use guest_name
CREATE OR REPLACE VIEW public.match_player_performance_view AS
SELECT 
    COALESCE(mp.match_id, pms.match_id, pds.match_id) AS match_id,
    COALESCE(mp.event_player_id, pms.event_player_id, pds.event_player_id) AS player_id,
    COALESCE(u.display_name, u.username, etp.guest_name, 'Unknown Player') AS player_name,
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


-- 3. Update tournament_player_stats_view to use guest_name
CREATE OR REPLACE VIEW public.tournament_player_stats_view AS
SELECT 
    et.event_id,
    etp.id AS event_player_id,
    u.unique_code AS player_unique_code,
    COALESCE(u.display_name, u.username, etp.guest_name, 'Unknown Player') AS player_name,
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
LEFT JOIN users u ON etp.user_id = u.id
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
GROUP BY et.event_id, etp.id, u.unique_code, u.display_name, u.username, etp.guest_name, et.id, et.team_name;

COMMIT;
