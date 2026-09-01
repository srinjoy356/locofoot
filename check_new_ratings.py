import psycopg2
DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT u.display_name, mpr.rating FROM match_player_ratings mpr JOIN event_team_players etp ON mpr.event_player_id = etp.id JOIN users u ON u.id = etp.user_id WHERE mpr.match_id = '4b622553-c518-4fa4-ad6e-cccd8e91f0b9';")
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()
