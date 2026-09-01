import psycopg2

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT status, match_state FROM matches WHERE event_id='54fe84f0-6d89-4bf3-a7f3-75c9db1707bf';")
print("Status vs Match states:", cur.fetchall())

cur.close()
conn.close()
