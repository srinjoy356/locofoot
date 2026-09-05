import os  
from supabase import create_client, Client  
url = 'https://lcxgjwdffkexrrnfcuik.supabase.co'  
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")  
supabase = create_client(url, key)  
res = supabase.table('notifications').select('*').limit(1).execute()  
print(res)  
