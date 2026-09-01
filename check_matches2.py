import psycopg2
DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT m.id, m.match_state, m.event_id FROM matches m WHERE m.event_id = '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf';")
print("MATCHES:")
for row in cur.fetchall():
    print(row)

cur.execute("SELECT * FROM team_form_view WHERE event_id = '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf';")
print("FORM:")
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()
