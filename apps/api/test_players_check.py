import os
from supabase import create_client
url = "https://lcxgjwdffkexrrnfcuik.supabase.co"
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.table('event_team_players').select('*').execute()
print("Players:")
for row in res.data:
    print(row)
