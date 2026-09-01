import psycopg2
DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT event_type FROM match_timeline_events WHERE match_id = '4b622553-c518-4fa4-ad6e-cccd8e91f0b9' AND event_type IN ('INTERCEPTION', 'CLEARANCE', 'AERIAL_DUEL');")
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()
