import os
from supabase import create_client
import psycopg2

def main():
    db_url = None
    with open('apps/api/.env', 'r') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                db_url = line.strip().split('=', 1)[1]

    # Need direct connection to run GRANT
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    cur.execute("GRANT SELECT ON public.users TO anon;")
    cur.execute("GRANT SELECT ON public.media_assets TO anon;")
    print("Granted.")

if __name__ == '__main__':
    main()
