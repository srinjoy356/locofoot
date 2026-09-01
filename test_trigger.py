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
    
    # We can check the function definition using an RPC or we can just try invoking the logic
    # But wait, supabase client cannot fetch function definitions.
    # Let's just manually run the update again! If the trigger works, it will create a new notification.
    
    # Let's cancel the invitation, then set it to pending
    print("Updating to CANCELLED...")
    res = supabase.table('event_team_invitations').update({'status': 'CANCELLED'}).eq('id', '67286a15-1956-4e49-97fa-27acae6f5ad6').execute()
    print("Cancelled:", res.data)
    
    print("Updating to PENDING...")
    res = supabase.table('event_team_invitations').update({'status': 'PENDING'}).eq('id', '67286a15-1956-4e49-97fa-27acae6f5ad6').execute()
    print("Pending:", res.data)
    
    print("Checking notifications...")
    notifs = supabase.table('notifications').select('*').eq('user_id', '6ffe8e8d-7a87-44e0-a422-82754a22a136').order('created_at', desc=True).execute()
    for n in notifs.data:
        print(n)

if __name__ == '__main__':
    main()
