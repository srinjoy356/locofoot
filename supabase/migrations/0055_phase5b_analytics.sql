-- Expand tournament_player_stats_view to include all detailed analytics columns
DROP VIEW IF EXISTS public.tournament_player_stats_view CASCADE;

CREATE OR REPLACE VIEW public.tournament_player_stats_view AS
SELECT 
    et.event_id,
    etp.id AS event_player_id,
    u.unique_code AS player_unique_code,
    COALESCE(u.display_name, u.username) AS player_name,
    et.id AS team_registration_id,
    et.team_name,
    COUNT(DISTINCT m.id) AS matches_played,
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
JOIN users u ON etp.user_id = u.id
JOIN event_team_registrations et ON etp.event_registration_id = et.id

-- 1. Matches where they were in the lineup
LEFT JOIN match_lineup_players mlp ON etp.id = mlp.event_team_player_id
LEFT JOIN match_lineups ml ON mlp.lineup_id = ml.id
LEFT JOIN matches m ON ml.match_id = m.id AND m.match_state = 'COMPLETED'

-- 2. Matches where they had stats recorded directly
LEFT JOIN (
    player_match_stats_view pms 
    JOIN matches m_pms ON pms.match_id = m_pms.id AND m_pms.match_state = 'COMPLETED'
) ON etp.id = pms.event_player_id AND (m.id IS NULL OR m.id = pms.match_id)

-- 3. Matches where they had performance ratings recorded directly
LEFT JOIN (
    match_player_performance_view mppv 
    JOIN matches m_mppv ON mppv.match_id = m_mppv.id AND m_mppv.match_state = 'COMPLETED'
) ON etp.id = mppv.player_id AND (m.id IS NULL OR m.id = mppv.match_id)

GROUP BY et.event_id, etp.id, u.unique_code, u.display_name, u.username, et.id, et.team_name;

GRANT SELECT ON public.tournament_player_stats_view TO authenticated, anon;
