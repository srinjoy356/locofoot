import psycopg2
DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT id FROM event_team_players WHERE event_registration_id = 'e20beae8-0c0b-4680-a618-97e3f94da983';") # We need to get Arnab Sahoo's id. Wait, we can get his ID from event_team_players and users table.
cur.execute("SELECT etp.id, u.display_name FROM event_team_players etp JOIN users u ON u.id = etp.user_id WHERE u.display_name = 'Arnab Sahoo';")
row = cur.fetchone()
if row:
    print(row)
    arnab_id = row[0]
    cur.execute(f"SELECT event_type, metadata FROM match_timeline_events WHERE match_id = '4b622553-c518-4fa4-ad6e-cccd8e91f0b9' AND actor_player_id = '{arnab_id}';")
    for r in cur.fetchall():
        print(r)
    cur.execute(f"SELECT event_type FROM referee_events WHERE match_id = '4b622553-c518-4fa4-ad6e-cccd8e91f0b9' AND event_player_id = '{arnab_id}';")
    for r in cur.fetchall():
        print(r)
cur.close()
conn.close()