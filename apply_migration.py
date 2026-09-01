import os
import psycopg2

def main():
    db_url = None
    with open('apps/api/.env', 'r') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                db_url = line.strip().split('=', 1)[1].strip('"').strip("'")
                break
                
    if not db_url:
        print("DATABASE_URL not found!")
        return
        
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    with open('supabase/migrations/0017_fix_invitation_notifications.sql', 'r') as f:
        sql = f.read()
    cur.execute(sql)
    conn.commit()
    cur.close()
    conn.close()
    print("Success!")

if __name__ == '__main__':
    main()
