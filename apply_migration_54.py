import psycopg2
import sys

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def run():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    with open('C:/dev/locofoot/supabase/migrations/0054_phase5a_tournament_stats.sql', 'r', encoding='utf-8') as f:
        sql = f.read()
    cur.execute(sql)
    print("Migration applied!")
    cur.close()
    conn.close()

if __name__ == '__main__':
    run()
