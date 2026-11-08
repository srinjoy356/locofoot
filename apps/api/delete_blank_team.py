import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

def main():
    print("Fetching teams...")
    res = supabase.table("event_team_registrations").select("id, team_name, status").eq("event_id", "1354ff44-0e67-41a1-bdc6-d12f6f4caddf").ilike("team_name", "%MAD TITANS%").execute()
    
    print("Found teams:", res.data)
    
    for team in res.data:
        team_id = team["id"]
        players_res = supabase.table("event_team_players").select("id", count="exact").eq("event_registration_id", team_id).execute()
        count = players_res.count
        print(f"Team {team['team_name']} (ID: {team_id}) has {count} players.")
        
        if count == 0 and team["status"] == "DRAFT":
            print(f"Deleting blank team {team_id}...")
            delete_res = supabase.table("event_team_registrations").delete().eq("id", team_id).execute()
            print("Delete response:", delete_res)
            print("Successfully deleted.")

if __name__ == "__main__":
    main()
