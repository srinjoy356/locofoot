import psycopg2

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def run():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute("""
    SELECT 
        et.event_id,
        etp.id AS event_player_id,
        pms.match_id as pms_match,
        mppv.match_id as mppv_match,
        m.id as m_match
    FROM event_team_players etp
    JOIN event_team_registrations et ON etp.event_registration_id = et.id
    LEFT JOIN match_lineup_players mlp ON etp.id = mlp.event_team_player_id
    LEFT JOIN match_lineups ml ON mlp.lineup_id = ml.id
    LEFT JOIN matches m ON ml.match_id = m.id AND m.status = 'COMPLETED'
    LEFT JOIN (
        player_match_stats_view pms 
        JOIN matches m_pms ON pms.match_id = m_pms.id AND m_pms.status = 'COMPLETED'
    ) ON etp.id = pms.event_player_id AND (m.id IS NULL OR m.id = pms.match_id)
    LEFT JOIN (
        match_player_performance_view mppv 
        JOIN matches m_mppv ON mppv.match_id = m_mppv.id AND m_mppv.status = 'COMPLETED'
    ) ON etp.id = mppv.player_id AND (m.id IS NULL OR m.id = mppv.match_id)
    WHERE et.event_id = '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf'
    AND (pms.match_id IS NOT NULL OR mppv.match_id IS NOT NULL)
    LIMIT 10;
    """)
    rows = cur.fetchall()
    print("Debug join rows:", rows)
    
    cur.execute("SELECT match_id, event_player_id FROM player_match_stats_view LIMIT 3;")
    print("pms sample:", cur.fetchall())
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    run()
