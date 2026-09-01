import pytest
import os
import uuid
import httpx
from fastapi.testclient import TestClient
from dotenv import load_dotenv
load_dotenv()

from app.main import app
from app.core.supabase_client import supabase_admin
from supabase import create_client

supabase_anon = create_client(
    os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321"),
    os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon_key")
)

@pytest.fixture(scope="session")
def test_client():
    with TestClient(app) as client:
        yield client

def create_and_login_user(role_name: str):
    email = f"test_{role_name.lower()}_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPassword123!"
    
    # Sign up the user
    res = supabase_anon.auth.sign_up({
        "email": email,
        "password": password
    })
    
    # Supabase handles auto-confirm if configured, but let's assume it is or use admin to confirm
    if not res.session:
        # Use admin to auto-confirm if necessary, but typically in dev it's auto-confirmed
        pass
        
    # Login to get fresh session
    login_res = supabase_anon.auth.sign_in_with_password({"email": email, "password": password})
    
    token = login_res.session.access_token
    user_id = login_res.user.id
    
    # Wait for the trigger to create the user profile
    import time
    time.sleep(1)
    
    # Get the generated unique code
    profile = supabase_admin.table('users').select('unique_code').eq('id', user_id).single().execute()
    unique_code = profile.data['unique_code'] if profile.data else None
    
    return {
        "id": user_id,
        "email": email,
        "password": password,
        "token": token,
        "unique_code": unique_code
    }

@pytest.fixture(scope="session")
def users():
    roles = [
        "ORGANIZER",
        "CAPTAIN",
        "PLAYER_FRIEND",
        "PLAYER_NON_FRIEND",
        "SECOND_CAPTAIN",
        "UNAUTHORIZED_USER"
    ]
    user_dict = {}
    for r in roles:
        user_dict[r] = create_and_login_user(r)
        
    # Make PLAYER_FRIEND friends with CAPTAIN
    captain_id = user_dict["CAPTAIN"]["id"]
    friend_id = user_dict["PLAYER_FRIEND"]["id"]
    
    # Insert friendship directly via admin
    supabase_admin.table('friendships').insert({
        "requester_id": captain_id,
        "addressee_id": friend_id,
        "status": "ACCEPTED"
    }).execute()
    
    return user_dict

@pytest.fixture
def auth_client(users):
    def _client(role: str):
        token = users[role]["token"]
        client = TestClient(app)
        client.headers.update({"Authorization": f"Bearer {token}"})
        return client
    return _client
