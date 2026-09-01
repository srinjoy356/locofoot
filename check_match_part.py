import psycopg2

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='match_participation';")
print([r[0] for r in cur.fetchall()])

cur.execute("SELECT count(*) FROM match_participation WHERE event_player_id IN (SELECT id FROM event_team_players WHERE event_registration_id IN (SELECT id FROM event_team_registrations WHERE event_id = '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf'));")
print("Participation count:", cur.fetchone()[0])
cur.close()
conn.close()
