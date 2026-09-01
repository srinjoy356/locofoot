-- migration to add tournament_player_stats_view and tournament_team_stats_view
CREATE OR REPLACE VIEW public.tournament_player_stats_view AS
SELECT 
    et.event_id,
    etp.id AS event_player_id,
    u.unique_code AS player_unique_code,
    COALESCE(u.display_name, u.username) AS player_name,
    et.id AS team_registration_id,
    et.team_name,
    COUNT(DISTINCT m.id) AS matches_played,
    SUM(pms.goals) AS goals,
    SUM(pms.assists) AS assists,
    SUM(pms.goals + pms.assists) AS goal_contributions,
    SUM(pms.shots) AS shots,
    SUM(pms.tackles_won) AS tackles,
    SUM(pms.interceptions) AS interceptions,
    SUM(pms.yellow_cards) AS yellow_cards,
    SUM(pms.red_cards) AS red_cards,
    AVG(mppv.rating) AS average_rating
FROM event_team_players etp
JOIN users u ON etp.user_id = u.id
JOIN event_team_registrations et ON etp.event_registration_id = et.id
LEFT JOIN match_lineup_players mlp ON etp.id = mlp.event_team_player_id
LEFT JOIN match_lineups ml ON mlp.lineup_id = ml.id
LEFT JOIN matches m ON ml.match_id = m.id AND m.status = 'COMPLETED'
LEFT JOIN player_match_stats_view pms ON m.id = pms.match_id AND etp.id = pms.event_player_id
LEFT JOIN match_player_performance_view mppv ON m.id = mppv.match_id AND etp.id = mppv.player_id
GROUP BY et.event_id, etp.id, u.unique_code, u.display_name, u.username, et.id, et.team_name;

GRANT SELECT ON public.tournament_player_stats_view TO authenticated, anon;
