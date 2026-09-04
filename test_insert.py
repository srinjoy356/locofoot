import asyncio
from supabase import create_client, Client

url = "https://lcxgjwdffkexrrnfcuik.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM"

supabase: Client = create_client(url, key)

def main():
    print("Testing announcements...")
    
    # Get an event
    res = supabase.table('events').select('id, created_by').limit(1).execute()
    if not res.data:
        print("No events found.")
        return
        
    event_id = res.data[0]['id']
    author_id = res.data[0]['created_by']
    
    print("Inserting normal announcement...")
    normal_res = supabase.table('event_announcements').insert({
        'event_id': event_id,
        'author_id': author_id,
        'message': 'This is a NORMAL broadcast test',
        'is_emergency': False
    }).execute()
    print("Normal inserted:", normal_res.data)
    
if __name__ == "__main__":
    main()
