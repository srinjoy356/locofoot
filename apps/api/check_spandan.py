import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

def main():
    print("--- All Teams ---")
    teams = supabase.table("event_team_registrations").select("*").ilike("team_name", "%SPANDAN%").execute()
    for t in teams.data:
        print(f"{t['team_name']}: {t['id']}, Event ID: {t['event_id']}")

if __name__ == "__main__":
    main()
