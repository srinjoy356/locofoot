import os
from supabase import create_client

def main():
    url = None
    service_key = None
    with open('apps/api/.env', 'r') as f:
        for line in f:
            if line.startswith('SUPABASE_URL='):
                url = line.strip().split('=', 1)[1]
            if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                service_key = line.strip().split('=', 1)[1]
                    
    supabase = create_client(url, service_key)
    
    res = supabase.table('users').select('*').eq('id', 'b459779d-92c2-449e-9c81-d8633c55b701').execute()
    print("Service Role users:", res)
    
    res = supabase.table('users').select('*, media_assets(*)').eq('id', 'b459779d-92c2-449e-9c81-d8633c55b701').execute()
    print("Service Role users+media:", res)

if __name__ == '__main__':
    main()
