import psycopg2
import sys

DATABASE_URL = "postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

def run():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("--- player_form_view ---")
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'player_form_view';")
    for row in cur.fetchall():
        print(row)
        
    print("--- team_form_view ---")
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'team_form_view';")
    for row in cur.fetchall():
        print(row)
        
    cur.execute("SELECT * FROM player_form_view LIMIT 2;")
    print("player_form_view data:", cur.fetchall())
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    run()
