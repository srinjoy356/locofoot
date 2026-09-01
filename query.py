import os  
from supabase import create_client  
from dotenv import load_dotenv  
load_dotenv('C:/dev/locofoot/apps/api/.env')  
url = os.environ.get('SUPABASE_URL')  
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')  
supabase = create_client(url, key)  
m = '65d1da9d-b887-43a5-a0a0-caba249337e6'  
print(supabase.table('match_participation').select('count').eq('match_id', m).execute())  
print(supabase.table('referee_events').select('count').eq('match_id', m).execute())  
print(supabase.table('referee_events').select('*').eq('match_id', m).execute().data)  
print(supabase.table('player_discipline_stats_view').select('*').eq('match_id', m).execute().data)  
print([r for r in supabase.table('referee_events').select('*').eq('match_id', m).execute().data if r['event_type'] in ['STOPPAGE_START', 'STOPPAGE_END']])  
