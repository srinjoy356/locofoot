import os
import uuid
import sys
from supabase import create_client

def main():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
    # For user creation we need the SERVICE_ROLE_KEY
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("Missing SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
        
    client = create_client(url, key)

    users = [
        {"email": "e2e_organizer@example.com", "password": "password123", "first_name": "E2E", "last_name": "Organizer"},
        {"email": "e2e_captain@example.com", "password": "password123", "first_name": "E2E", "last_name": "Captain"},
        {"email": "e2e_friend@example.com", "password": "password123", "first_name": "E2E", "last_name": "Friend"}
    ]
    
    user_ids = {}

    for u in users:
        # Check if exists
        try:
            res = client.auth.admin.create_user({
                "email": u["email"],
                "password": u["password"],
                "email_confirm": True,
                "user_metadata": {"first_name": u["first_name"], "last_name": u["last_name"]}
            })
            user_ids[u["email"]] = res.user.id
        except Exception as e:
            print("Failed to create", u["email"], str(e))
            # If it already exists, let's just get it... well, admin.list_users() is easier.
            pass

    print("Created users.")

    # Also add friendship between captain and friend
    # Get all users to find their IDs
    all_users = client.auth.admin.list_users().users
    cap_id = next((x.id for x in all_users if x.email == "e2e_captain@example.com"), None)
    friend_id = next((x.id for x in all_users if x.email == "e2e_friend@example.com"), None)
    org_id = next((x.id for x in all_users if x.email == "e2e_organizer@example.com"), None)
    
    if cap_id and friend_id:
        try:
            client.table('friendships').upsert({
                "requester_id": cap_id,
                "addressee_id": friend_id,
                "status": "ACCEPTED"
            }, on_conflict="requester_id, addressee_id").execute()
            print(f"Created friendship between {cap_id} and {friend_id}")
        except Exception as e:
            print("Friendship err", str(e))

    with open("e2e_data.json", "w") as f:
        import json
        json.dump({"org": org_id, "cap": cap_id, "friend": friend_id}, f)

if __name__ == "__main__":
    main()
