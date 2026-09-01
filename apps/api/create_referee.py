import os
import httpx
from dotenv import load_dotenv
from supabase import create_client

# We must run this from apps/api where python env has supabase
load_dotenv('../../.env')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

email = "referee@locofoot.com"
password = "password123"

# Try to create user
try:
    res = supabase.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True
    })
    user_id = res.user.id
except Exception as e:
    print(f"User probably exists: {e}")
    # Get user
    users = supabase.auth.admin.list_users()
    user_id = next((u.id for u in users if u.email == email), None)
    if not user_id:
        print("Could not find user either.")
        exit(1)

# Ensure profile exists
supabase.table("users").upsert({
    "id": user_id, 
    "email": email, 
    "username": "OfficialRef",
    "display_name": "Official Referee"
}).execute()

# Print unique code
res = supabase.table("users").select("unique_code").eq("id", user_id).single().execute()
print(f"EMAIL: {email}")
print(f"PASSWORD: {password}")
print(f"UNIQUE_CODE: {res.data['unique_code']}")
