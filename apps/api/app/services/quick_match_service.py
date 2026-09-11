import uuid
from typing import Dict, Any
from app.core.supabase_client import get_service_supabase
from app.schemas.quick_match import QuickMatchCreate
from fastapi import HTTPException

class QuickMatchService:
    @staticmethod
    def _resolve_user_id(admin_client, value: str | None) -> str | None:
        if not value:
            return None
        try:
            uuid.UUID(value)
            return value
        except ValueError:
            res = admin_client.table("users").select("id").eq("unique_code", value).execute()
            if not res.data:
                raise HTTPException(status_code=400, detail=f"User not found with code '{value}'")
            return res.data[0]["id"]

    @staticmethod
    def create_quick_match(data: QuickMatchCreate, user_id: str) -> Dict[str, Any]:
        admin_client = get_service_supabase()

        # 1. Create Event
        event_res = admin_client.table("events").insert({
            "name": data.match_name or "Quick Match",
            "description": "Auto-generated quick match",
            "organizer_id": user_id,
            "status": "LIVE",
            "type": "QUICK_MATCH",
            "venue_id": data.venue_id
        }).execute()

        if not event_res.data:
            raise HTTPException(status_code=500, detail="Failed to create event")
        
        event_id = event_res.data[0]["id"]

        # 1b. Create Event Settings (required for matches)
        admin_client.table("event_settings").insert({
            "event_id": event_id,
            "tournament_format": "CUSTOM",
            "players_on_field": data.players_on_field,
            "substitutes_allowed": data.substitutes_allowed,
            "first_half_minutes": data.first_half_minutes,
            "second_half_minutes": data.second_half_minutes
        }).execute()

        # 2. Assign Roles (Referee & Scorer)
        roles = [{"event_id": event_id, "user_id": user_id, "role": "EVENT_OWNER"}]
        
        resolved_referee_id = QuickMatchService._resolve_user_id(admin_client, data.referee_id)
        resolved_scorer_id = QuickMatchService._resolve_user_id(admin_client, data.scorer_id)
        
        if resolved_referee_id:
            roles.append({"event_id": event_id, "user_id": resolved_referee_id, "role": "REFEREE"})
        if resolved_scorer_id:
            roles.append({"event_id": event_id, "user_id": resolved_scorer_id, "role": "SCORER"})
        
        admin_client.table("event_roles").insert(roles).execute()

        # 3. Create Registrations
        reg_a_res = admin_client.table("event_team_registrations").insert({
            "event_id": event_id,
            "team_name": data.team_a.name,
            "captain_id": user_id,
            "status": "APPROVED",
            "approved_by": user_id
        }).execute()
        
        reg_b_res = admin_client.table("event_team_registrations").insert({
            "event_id": event_id,
            "team_name": data.team_b.name,
            "captain_id": user_id,
            "status": "APPROVED",
            "approved_by": user_id
        }).execute()

        reg_a_id = reg_a_res.data[0]["id"]
        reg_b_id = reg_b_res.data[0]["id"]

        # 5. Create Players
        players_to_insert = []
        for p in data.team_a.players:
            resolved_id = QuickMatchService._resolve_user_id(admin_client, p.user_id)
            players_to_insert.append({
                "event_registration_id": reg_a_id,
                "user_id": resolved_id,
                "guest_name": p.guest_name,
                "jersey_number": p.jersey_number,
                "status": "APPROVED"
            })
            
        for p in data.team_b.players:
            resolved_id = QuickMatchService._resolve_user_id(admin_client, p.user_id)
            players_to_insert.append({
                "event_registration_id": reg_b_id,
                "user_id": resolved_id,
                "guest_name": p.guest_name,
                "jersey_number": p.jersey_number,
                "status": "APPROVED"
            })

        if players_to_insert:
            admin_client.table("event_team_players").insert(players_to_insert).execute()

        # 6. Create Match
        match_res = admin_client.table("matches").insert({
            "event_id": event_id,
            "home_registration_id": reg_a_id,
            "away_registration_id": reg_b_id,
            "venue_field_id": data.venue_field_id,
            "status": "SCHEDULED",
            "scheduling_status": "ASSIGNED"
        }).execute()

        match_id = match_res.data[0]["id"]

        return {
            "match_id": match_id,
            "event_id": event_id
        }

    @staticmethod
    def delete_quick_match(event_id: str, user_id: str) -> None:
        admin_client = get_service_supabase()
        
        event_res = admin_client.table("events").select("organizer_id").eq("id", event_id).execute()
        if not event_res.data:
            raise HTTPException(status_code=404, detail="Quick match not found")
            
        if event_res.data[0]["organizer_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this quick match")
            
        delete_res = admin_client.table("events").delete().eq("id", event_id).execute()
        if not delete_res.data:
            raise HTTPException(status_code=500, detail="Failed to delete quick match")
