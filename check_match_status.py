import psycopg2

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT status FROM matches WHERE event_id='54fe84f0-6d89-4bf3-a7f3-75c9db1707bf';")
print("Match status:", cur.fetchall())

cur.execute("SELECT event_player_id, goals FROM player_match_stats_view ms JOIN matches m ON ms.match_id = m.id WHERE m.event_id='54fe84f0-6d89-4bf3-a7f3-75c9db1707bf' AND ms.goals > 0;")
print("PMS players with goals:", cur.fetchall())

cur.execute("SELECT etp.id FROM event_team_players etp JOIN event_team_registrations etr ON etr.id = etp.event_registration_id WHERE etr.event_id='54fe84f0-6d89-4bf3-a7f3-75c9db1707bf';")
print("ETP IDs:", cur.fetchall())

cur.close()
conn.close()
