import os
from supabase import create_client

def main():
    url = os.getenv('SUPABASE_URL')
    anon_key = os.getenv('SUPABASE_ANON_KEY')

    if not url or not anon_key:
        with open('apps/web/.env', 'r') as f:
            for line in f:
                if line.startswith('NEXT_PUBLIC_SUPABASE_URL='):
                    url = line.strip().split('=', 1)[1]
                if line.startswith('NEXT_PUBLIC_SUPABASE_ANON_KEY='):
                    anon_key = line.strip().split('=', 1)[1]
                    
    supabase = create_client(url, anon_key)
    
    # Do NOT set session, so we are anon
    try:
        res = supabase.table('users').select('*, media_assets(*)').eq('id', 'b459779d-92c2-449e-9c81-d8633c55b701').execute()
        print("Success:", res)
    except Exception as e:
        print("Error:", repr(e))

if __name__ == '__main__':
    main()
