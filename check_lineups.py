import psycopg2

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("""
    SELECT count(*) FROM match_lineups ml
    JOIN matches m ON m.id = ml.match_id
    WHERE m.event_id = '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf';
""")
print("Lineups count:", cur.fetchone()[0])

cur.execute("""
    SELECT count(*) FROM match_timeline_events mte
    JOIN matches m ON m.id = mte.match_id
    WHERE m.event_id = '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf';
""")
print("Timeline events count:", cur.fetchone()[0])

cur.close()
conn.close()
