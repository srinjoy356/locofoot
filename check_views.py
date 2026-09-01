import psycopg2
import json

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("""
    SELECT count(*) FROM player_match_stats_view ms
    JOIN matches m ON m.id = ms.match_id
    WHERE m.event_id = '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf';
""")
print("player_match_stats_view count:", cur.fetchone()[0])

cur.execute("""
    SELECT count(*) FROM tournament_player_stats_view
    WHERE event_id = '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf' AND matches_played > 0;
""")
print("tournament_player_stats_view matches_played > 0 count:", cur.fetchone()[0])

cur.close()
conn.close()
