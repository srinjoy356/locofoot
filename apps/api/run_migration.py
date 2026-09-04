import psycopg2
import os

db_url = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

with open("../../supabase/migrations/0064_phase6_operational.sql", "r", encoding="utf-8") as f:
    sql = f.read()

print("Connecting to DB...")
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()
print("Executing migration...")
cur.execute(sql)
print("Migration applied successfully.")
cur.close()
conn.close()
