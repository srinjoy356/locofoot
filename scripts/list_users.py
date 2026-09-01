import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env")
c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
users = c.auth.admin.list_users()
for u in users:
    print(u.id, u.email)
