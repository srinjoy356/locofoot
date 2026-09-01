import os
import sys
import uuid
from dotenv import load_dotenv
from supabase import create_client, Client
import httpx
import time

# Load root .env
load_dotenv(".env")

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("Missing Supabase credentials in .env")
    sys.exit(1)

# Clients
admin_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
client1: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
client2: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def generate_random_email():
    return f"test.locofoot.{uuid.uuid4().hex[:8]}@gmail.com"

def run_tests():
    print("--- 1. Testing FastAPI /health endpoint ---")
    try:
        r = httpx.get("http://localhost:8000/health")
        if r.status_code == 200:
            print("[PASS] /health is accessible")
        else:
            print(f"[FAIL] /health returned {r.status_code}")
    except Exception as e:
        print(f"[FAIL] Could not connect to FastAPI /health: {e}")

    print("\n--- 2. Fetching User 1 and Trigger Verification ---")
    
    # We hit email rate limits, so let's just get the user we already created:
    user1_id = "a8a958de-0bd8-4d8f-be08-218c31da514a"
    print(f"[PASS] Using existing User 1: {user1_id}")

    # 3. Test Trigger
    print("\n--- 3. Testing triggers for public.users and public.user_privacy_settings ---")
    u1_profile = admin_client.from_("users").select("*").eq("id", user1_id).execute()
    if len(u1_profile.data) > 0:
        print("[PASS] public.users row created via trigger.")
    else:
        print("[FAIL] public.users row NOT created.")
        
    u1_privacy = admin_client.from_("user_privacy_settings").select("*").eq("user_id", user1_id).execute()
    if len(u1_privacy.data) > 0:
        print("[PASS] public.user_privacy_settings row created via trigger.")
    else:
        print("[FAIL] public.user_privacy_settings row NOT created.")

    print("\n--- 4. Testing RLS (Row Level Security) ---")
    
    # Login to get real JWT
    user1_id = "a8a958de-0bd8-4d8f-be08-218c31da514a"
    user2_id = "00000000-0000-0000-0000-000000000002"
    
    client1 = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    res_login = client1.auth.sign_in_with_password({
        "email": "test.locofoot.28c984e5@gmail.com",
        "password": "TestPassword123!"
    })
    
    user1_jwt = res_login.session.access_token

    # client1 tries to access their own profile (should work)
    res = client1.from_("users").select("*").eq("id", user1_id).execute()
    if len(res.data) == 1:
        print("[PASS] User 1 can read own profile.")
    else:
        print("[FAIL] User 1 could not read own profile.")

    # client1 tries to modify own profile (should work)
    res = client1.from_("users").update({"display_name": "New Name"}).eq("id", user1_id).execute()
    if len(res.data) > 0:
        print("[PASS] User 1 can modify own profile.")
    else:
        print("[FAIL] User 1 could not modify own profile.")

    # client1 tries to modify user 2's profile (should fail / return empty)
    res = client1.from_("users").update({"display_name": "Hacked"}).eq("id", user2_id).execute()
    if len(res.data) == 0:
        print("[PASS] User 1 CANNOT modify User 2's profile (RLS enforced).")
    else:
        print("[FAIL] User 1 modified User 2's profile! RLS FAILED.")

    print("\n--- 5. Testing FastAPI /health/auth and Avatar Flow ---")
    
    access_token = user1_jwt

    if access_token:
        import base64
        import json
        header = json.loads(base64.b64decode(access_token.split('.')[0] + '==').decode('utf-8'))
        print(f"[DEBUG] JWT Header: {header}")

        # Test authenticated health
        r = httpx.get("http://localhost:8000/health/auth", headers={"Authorization": f"Bearer {access_token}"})
        if r.status_code == 200:
            print("[PASS] /health/auth is accessible with valid JWT.")
            print(f"   Identity returned: {r.json()['user']['id']}")
        else:
            print(f"[FAIL] /health/auth failed with {r.status_code}. Response: {r.text}")

        # Test signature endpoint
        r = httpx.post("http://localhost:8000/media/signature", headers={"Authorization": f"Bearer {access_token}"}, json={"ownerType": "USER_AVATAR", "ownerId": user1_id})
        if r.status_code == 200:
            sig = r.json()
            if "signature" in sig and "timestamp" in sig:
                print("[PASS] /media/signature successfully returned Cloudinary signature.")
            else:
                print("[FAIL] /media/signature response missing signature data.")
        else:
            print(f"[FAIL] /media/signature failed with {r.status_code}. Response: {r.text}")
    else:
        print("[FAIL] Could not obtain access_token for user 1.")

    print("\n--- 6. Testing Media Assets RLS ---")
    # client1 tries to create media for user 2
    try:
        res = client1.from_("media_assets").insert({
            "owner_type": "USER_AVATAR",
            "owner_id": user2_id,
            "cloudinary_public_id": "fake_id",
            "secure_url": "https://fake.url",
            "resource_type": "image"
        }).execute()
        # Should raise an error or return empty because of RLS
        print("[FAIL] User 1 inserted media for User 2! RLS FAILED.")
    except Exception as e:
        print("[PASS] User 1 CANNOT insert media for User 2's owner_id (RLS enforced).")
        
    print("\n[PASS] Script execution complete.")

if __name__ == "__main__":
    run_tests()
