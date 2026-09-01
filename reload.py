import os  
from supabase import create_client  
supabase = create_client(os.environ.get('SUPABASE_URL', 'http://localhost:54321'), os.environ.get('SUPABASE_SERVICE_ROLE_KEY', ''))  
print(supabase.table('match_lineups').select('*').limit(1).execute())  
