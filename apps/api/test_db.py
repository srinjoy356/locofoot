import os
from supabase import create_client

url = "https://lcxgjwdffkexrrnfcuik.supabase.co"
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.table('event_team_registrations').select('*', count='exact').eq('event_id', '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf').execute()
print(f"Total registrations for this event: {res.count}")

res2 = supabase.table('event_team_registrations').select('*', count='exact').eq('event_id', '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf').eq('status', 'ACCEPTED').execute()
print(f"ACCEPTED registrations for this event: {res2.count}")
