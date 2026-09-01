-- Phase 5: Leaderboard Aggregation RPC

BEGIN;

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
        COALESCE(u.display_name, u.username, 'Unknown Player')::TEXT AS player_name,
        pa.team_name::TEXT,
        pa.event_registration_id,
        pa.matches_played::INT,
        pa.minutes_played::INT,
        pa.metric_value::NUMERIC AS value
    FROM player_aggs pa
    JOIN public.event_team_players etp ON etp.id = pa.event_player_id
    JOIN public.users u ON u.id = etp.player_id
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

COMMIT;
