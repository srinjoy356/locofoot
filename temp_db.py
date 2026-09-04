import os
import psycopg2

def main():
    conn = psycopg2.connect("postgresql://postgres:postgres@127.0.0.1:54322/postgres")
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("ALTER PUBLICATION supabase_realtime ADD TABLE public.event_announcements;")
    cur.execute("ALTER PUBLICATION supabase_realtime ADD TABLE public.events;")
    cur.execute("ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;")
    print("SUCCESS")
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
