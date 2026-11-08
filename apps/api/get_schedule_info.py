import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

def main():
    event_id = "1354ff44-0e67-41a1-bdc6-d12f6f4caddf"
    
    print("--- Teams ---")
    teams = supabase.table("event_team_registrations").select("id, team_name").eq("event_id", event_id).execute()
    for t in teams.data:
        print(f"{t['team_name']}: {t['id']}")
        
    print("\n--- Slots ---")
    slots = supabase.table("schedule_slots").select("*").eq("event_id", event_id).order("scheduled_start").execute()
    for s in slots.data:
        print(f"Slot {s['id']}: {s['scheduled_start']}")
        assignments = supabase.table("slot_field_assignments").select("*").eq("schedule_slot_id", s['id']).execute()
        for a in assignments.data:
            print(f"  Field {a['venue_field_id']}, Fixture: {a['fixture_id']}, Assignment ID: {a['id']}")
            
    print("\n--- Matches ---")
    matches = supabase.table("matches").select("id, home_registration_id, away_registration_id, scheduling_status").eq("event_id", event_id).execute()
    for m in matches.data:
        print(m)

if __name__ == "__main__":
    main()
