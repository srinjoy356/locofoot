import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4, UUID
from app.core.supabase_client import get_service_supabase
from app.services.slot_service import slot_service
from app.schemas.scheduling import SlotFinalizeRequest, SlotTiming

async def run_test():
    supabase = get_service_supabase()
    user_id = "b459779d-92c2-449e-9c81-d8633c55b701"
    
    # 1. Get a venue with fields
    venue_res = supabase.table("venues").select("id").limit(1).execute()
    venue_id = venue_res.data[0]["id"]
    
    print("1. Creating test event...")
    event_res = supabase.table("events").insert({
        "name": "E2E Test Tournament",
        "description": "Test description",
        "slug": f"e2e-test-{uuid4().hex[:8]}",
        "organizer_id": user_id,
        "venue_id": venue_id,
        "status": "DRAFT",
        "slot_structure_state": "DRAFT",
        "scheduling_state": "NOT_STARTED"
    }).execute()
    event_id = event_res.data[0]["id"]
    
    print("2. Adding event settings...")
    supabase.table("event_settings").insert({
        "event_id": event_id,
        "tournament_format": "ROUND_ROBIN"
    }).execute()
    
    print("3. Running slot_service.finalize_slots()...")
    # Simulate the frontend sending generated slots
    now = datetime.now(timezone.utc)
    payload = SlotFinalizeRequest(slots=[
        SlotTiming(sequence=1, start=now, end=now + timedelta(minutes=60)),
        SlotTiming(sequence=2, start=now + timedelta(minutes=60), end=now + timedelta(minutes=120))
    ])
    
    await slot_service.finalize_slots(UUID(event_id), payload)
    
    print("4. Verifying database state...")
    slots = supabase.table("schedule_slots").select("id, sequence_number").eq("event_id", event_id).execute().data
    print(f"-> Created {len(slots)} time slots.")
    
    assignments = supabase.table("slot_field_assignments").select("id, schedule_slot_id, venue_field_id").in_("schedule_slot_id", [s["id"] for s in slots]).execute().data
    print(f"-> Created {len(assignments)} physical field assignments.")
    
    fields = supabase.table("venue_fields").select("id").eq("venue_id", venue_id).execute().data
    print(f"-> Venue has {len(fields)} fields.")
    print(f"-> {len(slots)} slots * {len(fields)} fields = {len(slots) * len(fields)} expected assignments.")
    
    if len(assignments) == len(slots) * len(fields):
        print("\nSUCCESS: The new logic automatically multiplied time slots by venue fields!")
    else:
        print("\nFAILURE: Assignments count does not match expected!")

asyncio.run(run_test())
