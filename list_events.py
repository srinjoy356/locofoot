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
    
    events = supabase.table('events').select('id, name, organizer_id').execute()
    print("Events:")
    for e in events.data:
        print(f"ID: {e['id']} | Name: {e['name']} | Organizer ID: {e['organizer_id']}")
        
if __name__ == '__main__':
    main()
