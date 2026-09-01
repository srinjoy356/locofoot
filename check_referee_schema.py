import psycopg2
DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'referee_events';")
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()