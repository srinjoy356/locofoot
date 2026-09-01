import psycopg2

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

sql = """
CREATE OR REPLACE VIEW public.tournament_player_stats_view AS
SELECT 
    et.event_id,
    etp.id AS event_player_id,
    u.unique_code AS player_unique_code,
    COALESCE(u.display_name, u.username) AS player_name,
    et.id AS team_registration_id,
    et.team_name,
    COUNT(DISTINCT COALESCE(m.id, pms.match_id, mppv.match_id)) AS matches_played,
    SUM(mppv.minutes_played) AS minutes_played,
    
    -- Attack & Playmaking
    COALESCE(SUM(pms.goals), 0) AS goals,
    COALESCE(SUM(pms.penalty_goals), 0) AS penalty_goals,
    COALESCE(SUM(pms.assists), 0) AS assists,
    COALESCE(SUM(pms.goals + pms.assists), 0) AS goal_contributions,
    COALESCE(SUM(pms.shots), 0) AS shots,
    COALESCE(SUM(pms.shots_on_target), 0) AS shots_on_target,
    
    COALESCE(SUM(pms.passes_attempted), 0) AS passes_attempted,
    COALESCE(SUM(pms.passes_completed), 0) AS passes_completed,
    COALESCE(SUM(pms.key_passes), 0) AS key_passes,
    COALESCE(SUM(pms.through_balls), 0) AS through_balls,
    COALESCE(SUM(pms.crosses), 0) AS crosses,
    
    COALESCE(SUM(pms.dribbles_attempted), 0) AS dribbles_attempted,
    COALESCE(SUM(pms.successful_dribbles), 0) AS successful_dribbles,
    
    -- Defending
    COALESCE(SUM(pms.tackles_attempted), 0) AS tackles_attempted,
    COALESCE(SUM(pms.tackles_won), 0) AS tackles,
    COALESCE(SUM(pms.interceptions), 0) AS interceptions,
    COALESCE(SUM(pms.recoveries), 0) AS recoveries,
    COALESCE(SUM(pms.clearances), 0) AS clearances,
    COALESCE(SUM(pms.blocks), 0) AS blocks,
    COALESCE(SUM(pms.aerials_won), 0) AS aerials_won,
    
    -- Goalkeeping
    COALESCE(SUM(pms.saves), 0) AS saves,
    COALESCE(SUM(pms.penalty_saves), 0) AS penalty_saves,
    COALESCE(SUM(pms.saves_1v1), 0) AS saves_1v1,
    
    -- Discipline
    COALESCE(SUM(pms.fouls_committed), 0) AS fouls_committed,
    COALESCE(SUM(pms.fouls_drawn), 0) AS fouls_drawn,
    COALESCE(SUM(pms.yellow_cards), 0) AS yellow_cards,
    COALESCE(SUM(pms.red_cards), 0) AS red_cards,
    
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
"""

def run():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(sql)
    conn.commit()
    print("Updated tournament_player_stats_view!")
    
    cur.execute("SELECT count(*) FROM tournament_player_stats_view WHERE matches_played > 0;")
    print("Players with matches > 0:", cur.fetchone()[0])
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    run()
