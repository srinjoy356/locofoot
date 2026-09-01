import os
from supabase import create_client
import psycopg2

def main():
    db_url = None
    with open('apps/api/.env', 'r') as f:
        for line in f:
            if line.startswith('SUPABASE_URL='):
                url = line.strip().split('=', 1)[1]
            if line.startswith('DATABASE_URL='):
                db_url = line.strip().split('=', 1)[1]

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'users';")
    for row in cur.fetchall():
        print(row)

if __name__ == '__main__':
    main()
