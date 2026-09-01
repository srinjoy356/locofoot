import psycopg2

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT view_definition FROM information_schema.views WHERE table_name='tournament_standings_view';")
print(cur.fetchone()[0])

cur.close()
conn.close()
