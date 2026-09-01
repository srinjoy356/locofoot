import os
from supabase import create_client

def main():
    db_url = None
    with open('apps/api/.env', 'r') as f:
        for line in f:
            if line.startswith('SUPABASE_URL='):
                url = line.strip().split('=', 1)[1]
            if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                key = line.strip().split('=', 1)[1]
                
    supabase = create_client(url, key)
    
    res = supabase.table('events').delete().neq('organizer_id', 'b459779d-92c2-449e-9c81-d8633c55b701').execute()
    print(f"Deleted {len(res.data)} events.")

if __name__ == '__main__':
    main()
