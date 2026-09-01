import psycopg2
import json

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("""
    SELECT epr.id FROM event_player_registrations epr
    JOIN event_team_registrations etr ON etr.id = epr.team_registration_id
    WHERE etr.event_id = '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf'
    LIMIT 3;
""")
print("Event Player IDs:", cur.fetchall())

cur.execute("""
    SELECT actor_player_id FROM match_timeline_events mte
    JOIN matches m ON m.id = mte.match_id
    WHERE m.event_id = '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf' AND actor_player_id IS NOT NULL
    LIMIT 3;
""")
print("Timeline actor IDs:", cur.fetchall())

cur.close()
conn.close()
