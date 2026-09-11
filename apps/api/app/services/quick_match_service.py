import uuid
from typing import Dict, Any
from app.core.supabase_client import get_supabase_admin
from app.schemas.quick_match import QuickMatchCreate
from fastapi import HTTPException

class QuickMatchService:
    @staticmethod
    def create_quick_match(data: QuickMatchCreate, user_id: str) -> Dict[str, Any]:
        admin_client = get_supabase_admin()

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
            "tournament_format": "CUSTOM"
        }).execute()

        # 2. Assign Roles (Referee & Scorer)
        roles = [{"event_id": event_id, "user_id": user_id, "role": "EVENT_OWNER"}]
        if data.referee_id:
            roles.append({"event_id": event_id, "user_id": data.referee_id, "role": "REFEREE"})
        if data.scorer_id:
            roles.append({"event_id": event_id, "user_id": data.scorer_id, "role": "SCORER"})
        
        admin_client.table("event_roles").insert(roles).execute()

        # 3. Create Teams
        team_a_id = str(uuid.uuid4())
        team_b_id = str(uuid.uuid4())
        
        admin_client.table("teams").insert([
            {"id": team_a_id, "name": data.team_a.name, "created_by": user_id},
            {"id": team_b_id, "name": data.team_b.name, "created_by": user_id}
        ]).execute()

        # 4. Create Registrations
        reg_a_res = admin_client.table("event_team_registrations").insert({
            "event_id": event_id,
            "team_id": team_a_id,
            "status": "APPROVED",
            "approved_by": user_id
        }).execute()
        
        reg_b_res = admin_client.table("event_team_registrations").insert({
            "event_id": event_id,
            "team_id": team_b_id,
            "status": "APPROVED",
            "approved_by": user_id
        }).execute()

        reg_a_id = reg_a_res.data[0]["id"]
        reg_b_id = reg_b_res.data[0]["id"]

        # 5. Create Players
        players_to_insert = []
        for p in data.team_a.players:
            players_to_insert.append({
                "event_registration_id": reg_a_id,
                "user_id": p.user_id,
                "guest_name": p.guest_name,
                "jersey_number": p.jersey_number,
                "status": "APPROVED"
            })
            
        for p in data.team_b.players:
            players_to_insert.append({
                "event_registration_id": reg_b_id,
                "user_id": p.user_id,
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
            "status": "SCHEDULED"
        }).execute()

        match_id = match_res.data[0]["id"]

        return {
            "match_id": match_id,
            "event_id": event_id
        }
