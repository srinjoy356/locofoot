import os
from supabase import create_client

url = "https://lcxgjwdffkexrrnfcuik.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM"
supabase = create_client(url, key)

res = supabase.table('event_team_registrations').select('*', count='exact').eq('event_id', '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf').execute()
print(f"Total registrations for this event: {res.count}")

res2 = supabase.table('event_team_registrations').select('*', count='exact').eq('event_id', '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf').eq('status', 'ACCEPTED').execute()
print(f"ACCEPTED registrations for this event: {res2.count}")
