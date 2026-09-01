import psycopg2
DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT event_type, metadata FROM match_timeline_events WHERE match_id = '94bbf93c-98a1-4ac5-b324-d9bc7f29ef33';")
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()
