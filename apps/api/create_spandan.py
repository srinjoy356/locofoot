import os
import uuid
import sys
from dotenv import load_dotenv
from supabase import create_client
import time

def main():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    client = create_client(url, key)
    
    # Get the team
    team_res = client.table("event_team_registrations").select("id").eq("team_name", "TEAM SPANDAN").execute()
    if not team_res.data:
        print("Team not found")
        sys.exit(1)
        
    reg_id = team_res.data[0]["id"]
    print("Reg ID:", reg_id)
    
    user_ids = ['578e5279-a339-4ea0-9ee0-629ef45370b3', '4c36eb4a-6012-446d-843a-ff48fa538aa4', '5ef9eb2a-9e18-417e-8734-9e097c9bde09', '2412bba4-650a-479c-ba84-c44c4816daa1', '72d94751-1ac7-4af2-b5e2-8c8eee9a6bcf', '5f95c48c-5537-41b7-ba85-2cfd2e747eed']
    
    players_data = []
    for uid in user_ids:
        players_data.append({
            "event_registration_id": reg_id,
            "user_id": uid
        })
        
    try:
        client.table("event_team_players").insert(players_data).execute()
        print("Added players.")
    except Exception as e:
        print("Failed to add players", e)

if __name__ == "__main__":
    main()
