from app.core.supabase_client import supabase_admin; print(supabase_admin.table('event_roles').select('*').eq('event_id', 'e580d21c-52f0-43d2-a140-6c602afce51f').execute())  
