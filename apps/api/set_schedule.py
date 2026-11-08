import os
import uuid
import sys
from dotenv import load_dotenv
from supabase import create_client

def main():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    client = create_client(url, key)
    event_id = "1354ff44-0e67-41a1-bdc6-d12f6f4caddf"
    
    # Map from standard names to DB IDs
    teams = {
        "HOTAT ATONKO": "b07e563e-2c42-4aae-9127-4f559d2b7431",
        "ROKTO GOROM FC": "5f01145d-888a-4299-8b53-ed21a13b84e1",
        "HEXA NET BREAKERS": "5d153659-d22f-4a4a-a23e-7e8c55d5dd15",
        "TEAM SPANDAN": "72d6c196-b65c-43d3-bc09-b6fefa156aa6",
        "TEAM PREDATOR": "8afca4ac-1ea1-432b-ad69-b12932f274d4",
        "MAD TITANS": "48fd242f-cccb-4ba9-ac6b-21c80d8c22e5"
    }
    
    schedule = [
        ("HOTAT ATONKO", "ROKTO GOROM FC"),
        ("HEXA NET BREAKERS", "TEAM SPANDAN"),
        ("HOTAT ATONKO", "TEAM PREDATOR"),
        ("MAD TITANS", "ROKTO GOROM FC"),
        ("HEXA NET BREAKERS", "TEAM PREDATOR"),
        ("TEAM SPANDAN", "HOTAT ATONKO"),
        ("MAD TITANS", "HEXA NET BREAKERS"),
        ("TEAM PREDATOR", "ROKTO GOROM FC"),
        ("MAD TITANS", "TEAM SPANDAN"),
        ("HOTAT ATONKO", "HEXA NET BREAKERS"),
        ("TEAM PREDATOR", "TEAM SPANDAN"),
        ("HEXA NET BREAKERS", "ROKTO GOROM FC"),
        ("MAD TITANS", "HOTAT ATONKO"),
        ("TEAM SPANDAN", "ROKTO GOROM FC"),
        ("MAD TITANS", "TEAM PREDATOR")
    ]
    
    # Delete existing matches for safety
    print("Deleting old matches...")
    client.table("matches").delete().eq("event_id", event_id).execute()
    
    # Reset slots assignments
    print("Resetting assignments...")
    slots_res = client.table("schedule_slots").select("id").eq("event_id", event_id).execute()
    for s in slots_res.data:
        client.table("slot_field_assignments").update({"fixture_id": None}).eq("schedule_slot_id", s["id"]).execute()
        
    print("Fetching slots ordered by time...")
    slots = client.table("schedule_slots").select("*").eq("event_id", event_id).order("scheduled_start").execute()
    
    if len(slots.data) < 15:
        print(f"Not enough slots! Found {len(slots.data)}")
        return
        
    print("Creating matches...")
    for i, (home_name, away_name) in enumerate(schedule):
        slot = slots.data[i]
        
        # find the field assignment for this slot
        assign_res = client.table("slot_field_assignments").select("*").eq("schedule_slot_id", slot["id"]).execute()
        if not assign_res.data:
            print(f"No field assignment for slot {slot['id']}")
            continue
            
        assignment = assign_res.data[0]
        
        match_id = str(uuid.uuid4())
        client.table("matches").insert({
            "id": match_id,
            "event_id": event_id,
            "home_registration_id": teams[home_name],
            "away_registration_id": teams[away_name],
            "status": "SCHEDULED",
            "scheduling_status": "ASSIGNED",
            "scheduled_start": slot["scheduled_start"],
            "venue_field_id": assignment["venue_field_id"],
            "match_state": "SCHEDULED"
        }).execute()
        
        # update slot assignment
        client.table("slot_field_assignments").update({"fixture_id": match_id}).eq("id", assignment["id"]).execute()
        
        # update slot status
        client.table("schedule_slots").update({"status": "PARTIALLY_ASSIGNED"}).eq("id", slot["id"]).execute()
        
        print(f"Scheduled {i+1}: {home_name} vs {away_name}")

if __name__ == "__main__":
    main()
