import json
from uuid import UUID
from fastapi import HTTPException
import httpx
from app.config import settings
from app.schemas.scheduling import AISlotGenerationRequest, AISlotGenerationResponse, SlotFinalizeRequest, SlotAppendRequest
from app.core.supabase_client import get_service_supabase

class SlotService:
    async def generate_slots_ai(self, event_id: UUID, payload: AISlotGenerationRequest) -> AISlotGenerationResponse:
        supabase = get_service_supabase()
        
        # Verify event and get settings
        event_res = supabase.table("events").select("*, event_settings(*)").eq("id", str(event_id)).execute()
        if not event_res.data:
            raise HTTPException(status_code=404, detail="Event not found")
        
        event = event_res.data[0]
        
        # Abort if format isn't defined or settings missing
        if not event.get("event_settings"):
            raise HTTPException(status_code=400, detail="Event settings not fully configured")
        
        settings_data = event["event_settings"]
        
        # Calculate single match duration in minutes
        match_duration = (
            settings_data.get("first_half_minutes", 45) +
            settings_data.get("half_time_minutes", 15) +
            settings_data.get("second_half_minutes", 45)
        )
        buffer_minutes = settings_data.get("buffer_minutes", 15)
        total_slot_minutes = match_duration + buffer_minutes

        system_prompt = (
            "You are a sports scheduling assistant. Your job is to output a strictly formatted JSON object containing slot timings. "
            f"The organizer's timezone is {payload.timezone}. "
            f"Each slot must have a total allocated time of {total_slot_minutes} minutes ({match_duration} mins match + {buffer_minutes} mins buffer). "
            "Gaps between slots should be based on this buffer. "
            "Output sequence numbers starting from 1."
        )

        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }

        # Use Structured Outputs
        data = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": payload.prompt}
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "slot_response",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "timezone": {"type": "string"},
                            "slots": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "sequence": {"type": "integer"},
                                        "start": {"type": "string", "format": "date-time"},
                                        "end": {"type": "string", "format": "date-time"}
                                    },
                                    "required": ["sequence", "start", "end"],
                                    "additionalProperties": False
                                }
                            }
                        },
                        "required": ["timezone", "slots"],
                        "additionalProperties": False
                    },
                    "strict": True
                }
            }
        }

        if not settings.OPENAI_API_KEY:
             raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=data)
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="AI generation failed")
            
            result = response.json()
            try:
                message_content = result["choices"][0]["message"]["content"]
                parsed_json = json.loads(message_content)
                return AISlotGenerationResponse(**parsed_json)
            except (KeyError, json.JSONDecodeError) as e:
                raise HTTPException(status_code=500, detail="Failed to parse AI response")

    async def finalize_slots(self, event_id: UUID, payload: SlotFinalizeRequest) -> dict:
        supabase = get_service_supabase()
        
        # Revalidate that they can edit
        event_res = supabase.table("events").select("slot_structure_state, scheduling_state, venue_id").eq("id", str(event_id)).execute()
        if not event_res.data:
            raise HTTPException(status_code=404, detail="Event not found")
            
        event = event_res.data[0]
        if event["scheduling_state"] != "NOT_STARTED":
            raise HTTPException(status_code=400, detail="Cannot finalize slots after scheduling has started")

        # Delete existing empty slots
        supabase.table("schedule_slots").delete().eq("event_id", str(event_id)).execute()

        slots_to_insert = [
            {
                "event_id": str(event_id),
                "sequence_number": slot.sequence,
                "scheduled_start": slot.start.isoformat(),
                "scheduled_end": slot.end.isoformat(),
                "status": "EMPTY"
            } for slot in payload.slots
        ]

        if slots_to_insert:
            # Need to get the inserted IDs to create assignments
            inserted = supabase.table("schedule_slots").insert(slots_to_insert).execute()
            
            # Fetch venue fields
            venue_id = event.get("venue_id")
            if venue_id:
                fields_res = supabase.table("venue_fields").select("id").eq("venue_id", venue_id).execute()
                if fields_res.data:
                    assignments = []
                    for slot in inserted.data:
                        for field in fields_res.data:
                            assignments.append({
                                "schedule_slot_id": slot["id"],
                                "venue_field_id": field["id"]
                            })
                    if assignments:
                        supabase.table("slot_field_assignments").insert(assignments).execute()
        
        # Update event state
        supabase.table("events").update({"slot_structure_state": "FINALIZED"}).eq("id", str(event_id)).execute()

        # Audit
        # (Audit trail to be implemented)

        return {"success": True, "message": "Slots finalized successfully"}

    async def append_slots(self, event_id: UUID, payload: SlotAppendRequest) -> dict:
        supabase = get_service_supabase()
        
        event_res = supabase.table("events").select("slot_structure_state, scheduling_state, venue_id").eq("id", str(event_id)).execute()
        if not event_res.data:
            raise HTTPException(status_code=404, detail="Event not found")
            
        event = event_res.data[0]
        
        slots_to_insert = [
            {
                "event_id": str(event_id),
                "sequence_number": slot.sequence,
                "scheduled_start": slot.start.isoformat(),
                "scheduled_end": slot.end.isoformat(),
                "status": "EMPTY"
            } for slot in payload.slots
        ]

        if slots_to_insert:
            inserted = supabase.table("schedule_slots").insert(slots_to_insert).execute()
            
            venue_id = event.get("venue_id")
            if venue_id:
                fields_res = supabase.table("venue_fields").select("id").eq("venue_id", venue_id).execute()
                if fields_res.data:
                    assignments = []
                    for slot in inserted.data:
                        for field in fields_res.data:
                            assignments.append({
                                "schedule_slot_id": slot["id"],
                                "venue_field_id": field["id"]
                            })
                    if assignments:
                        supabase.table("slot_field_assignments").insert(assignments).execute()
        
        return {"success": True, "message": "Slots appended successfully"}

slot_service = SlotService()
