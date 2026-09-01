import os  
from supabase import create_client  
supabase = create_client(os.environ.get('SUPABASE_URL', 'http://localhost:54321'), os.environ.get('SUPABASE_SERVICE_ROLE_KEY', ''))  
res = supabase.rpc('execute_sql', {'query': 'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\''}).execute()  
print(res)  
