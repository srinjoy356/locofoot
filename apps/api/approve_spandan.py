import os
import sys
from dotenv import load_dotenv
from supabase import create_client
import datetime

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
    
    # Approve it
    now = datetime.datetime.utcnow().isoformat()
    client.table("event_team_registrations").update({"status": "APPROVED", "approved_at": now}).eq("id", reg_id).execute()
    print("Approved TEAM SPANDAN.")

if __name__ == "__main__":
    main()
