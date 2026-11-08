import os
import sys
from dotenv import load_dotenv
from supabase import create_client

def main():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    client = create_client(url, key)
    
    user_ids = [
        '578e5279-a339-4ea0-9ee0-629ef45370b3', 
        '4c36eb4a-6012-446d-843a-ff48fa538aa4', 
        '5ef9eb2a-9e18-417e-8734-9e097c9bde09', 
        '2412bba4-650a-479c-ba84-c44c4816daa1', 
        '72d94751-1ac7-4af2-b5e2-8c8eee9a6bcf', 
        '5f95c48c-5537-41b7-ba85-2cfd2e747eed'
    ]
    
    names = [
        ("Dr. Pranoy", "Ghosh"),
        ("Munna", "Mondal"),
        ("Sagar", ""),
        ("Manoj", ""),
        ("Sofi", ""),
        ("Dabu", "")
    ]
    
    for i, uid in enumerate(user_ids):
        fn, ln = names[i]
        display = f"{fn} {ln}".strip()
        print(f"Updating {uid} to {display}")
        
        # update auth metadata
        client.auth.admin.update_user_by_id(uid, {"user_metadata": {"first_name": fn, "last_name": ln, "name": display}})
        # update public users table
        client.table("users").update({"display_name": display}).eq("id", uid).execute()
        
    print("Done updating names.")

if __name__ == "__main__":
    main()
