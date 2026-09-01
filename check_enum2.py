import psycopg2
DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT enumlabel FROM pg_enum WHERE enumtypid = 'timeline_event_type'::regtype;")
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()