import os
from supabase import create_client
supabase = create_client('https://lcxgjwdffkexrrnfcuik.supabase.co', os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
try:
    res = supabase.from_('matches').select('id, scheduled_start, status, home_team:event_team_registrations!home_registration_id(team:teams(name, short_name, logo_media_id)), away_team:event_team_registrations!away_registration_id(team:teams(name, short_name, logo_media_id)), venue_field:venue_fields(name)').eq('event_id', '54fe84f0-6d89-4bf3-a7f3-75c9db1707bf').eq('scheduling_status', 'ASSIGNED').execute()
    print(res)
except Exception as e:
    print(str(e))