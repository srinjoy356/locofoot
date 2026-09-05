import os
from supabase import create_client
url = "https://lcxgjwdffkexrrnfcuik.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeGdqd2RmZmtleHJybmZjdWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU0MDEwMCwiZXhwIjoyMTAzMTE2MTAwfQ.rU1nB3a9wmRR_lXOMbGbm7od6kVlXLY6-S7bDgJR0nM"
supabase = create_client(url, key)

res = supabase.table('event_team_players').select('*').execute()
print("Players:")
for row in res.data:
    print(row)
