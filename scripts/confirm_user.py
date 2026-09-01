import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env")
c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
c.auth.admin.update_user_by_id('a8a958de-0bd8-4d8f-be08-218c31da514a', {'email_confirm': True})
print("User confirmed")
