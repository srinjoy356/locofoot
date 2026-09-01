import json
from uuid import UUID
from datetime import datetime
from fastapi import HTTPException
from typing import List, Set, Dict, Any
from app.core.supabase_client import get_service_supabase
from app.schemas.scheduling import ScheduleNextRequest, ScheduleOverrideRequest, ScheduleReshuffleRequest
from app.services.idempotency_service import IdempotencyService

class SchedulingService:

    @staticmethod
    def _get_possible_teams_for_bracket(supabase, match_id: UUID) -> Set[str]:
        # Traverses bracket tree backward to find all possible registration IDs that could reach this match
        possible_teams = set()
        
        def traverse(current_match_id):
            if not current_match_id: return
            match_res = supabase.table("matches").select("*").eq("id", str(current_match_id)).execute()
            if not match_res.data: return
            m = match_res.data[0]
            
            if m["home_registration_id"]:
                possible_teams.add(m["home_registration_id"])
            if m["away_registration_id"]:
                possible_teams.add(m["away_registration_id"])
                
            if m["bracket_id"]:
                bracket_res = supabase.table("brackets").select("*").eq("id", m["bracket_id"]).execute()
                if bracket_res.data:
                    b = bracket_res.data[0]
                    home_source = b.get("home_source", {})
                    away_source = b.get("away_source", {})
                    
                    if home_source.get("type") == "winner_of":
                        traverse(home_source.get("match_id"))
                    if away_source.get("type") == "winner_of":
                        traverse(away_source.get("match_id"))

        traverse(match_id)
        return possible_teams

    async def generate_next_slot(self, event_id: UUID, payload: ScheduleNextRequest, actor_id: UUID) -> dict:
        cached = IdempotencyService.check_idempotency(payload.idempotency_key, event_id, "GENERATE_NEXT_SLOT")
        if cached:
            return cached

        supabase = get_service_supabase()
        
        event_res = supabase.table("events").select("scheduling_state, slot_structure_state").eq("id", str(event_id)).execute()
        if not event_res.data or event_res.data[0]["scheduling_state"] != "LIVE":
            raise HTTPException(status_code=400, detail="Event is not in LIVE scheduling state")
            
        empty_assignments_res = supabase.table("slot_field_assignments")\
            .select("*, schedule_slots(*)")\
            .is_("fixture_id", "null")\
            .eq("schedule_slots.event_id", str(event_id))\
            .order("schedule_slots(sequence_number)", desc=False)\
            .limit(1)\
            .execute()
            
        if not empty_assignments_res.data:
            raise HTTPException(status_code=400, detail="No empty slots remaining")
            
        target_assignment = empty_assignments_res.data[0]
        target_slot = target_assignment["schedule_slots"]
        target_seq = target_slot["sequence_number"]
        
        preceding_seq = target_seq - 1
        preceding_teams = set()
        if preceding_seq > 0:
            # Fetch the schedule_slot_id for the preceding sequence first to avoid PostgREST join filter issues
            prev_slot_res = supabase.table("schedule_slots").select("id").eq("event_id", str(event_id)).eq("sequence_number", preceding_seq).execute()
            if prev_slot_res.data:
                prev_slot_id = prev_slot_res.data[0]["id"]
                preceding_assignments_res = supabase.table("slot_field_assignments")\
                    .select("fixture_id")\
                    .eq("schedule_slot_id", prev_slot_id)\
                    .not_.is_("fixture_id", "null")\
                    .execute()
                    
                for row in preceding_assignments_res.data:
                    fid = row["fixture_id"]
                    if not fid: continue
                    # Fetch teams for this fixture
                    fix_res = supabase.table("matches").select("home_registration_id, away_registration_id, bracket_id").eq("id", fid).execute()
                    if fix_res.data:
                        f = fix_res.data[0]
                        if f["home_registration_id"]: preceding_teams.add(f["home_registration_id"])
                        if f["away_registration_id"]: preceding_teams.add(f["away_registration_id"])
                        if f["bracket_id"] and not f["home_registration_id"] and not f["away_registration_id"]:
                            preceding_teams.update(self._get_possible_teams_for_bracket(supabase, fid))
        
        unassigned_res = supabase.table("matches")\
            .select("*")\
            .eq("event_id", str(event_id))\
            .eq("scheduling_status", "UNASSIGNED")\
            .order("created_at")\
            .execute()
            
        if not unassigned_res.data:
            raise HTTPException(status_code=400, detail="No unassigned fixtures available")
            
        unassigned = unassigned_res.data
        
        valid_candidates = []
        for m in unassigned:
            c_teams = set()
            if m["home_registration_id"]: c_teams.add(m["home_registration_id"])
            if m["away_registration_id"]: c_teams.add(m["away_registration_id"])
            if m["bracket_id"] and not c_teams:
                c_teams = self._get_possible_teams_for_bracket(supabase, m["id"])
                
            if c_teams.intersection(preceding_teams):
                continue
            valid_candidates.append(m)
            
        if not valid_candidates:
            # If mathematically impossible to avoid back-to-back matches, fallback to allowing them
            valid_candidates = unassigned
            
        # Find the first valid candidate that doesn't lead to a dead end
        # We do this by running a simple DFS simulation of the remaining unassigned matches
        def can_complete_schedule(current_preceding_teams, remaining_matches, slots_to_fill):
            if slots_to_fill == 0 or len(remaining_matches) == 0:
                return True
                
            for m in remaining_matches:
                m_teams = set()
                if m["home_registration_id"]: m_teams.add(m["home_registration_id"])
                if m["away_registration_id"]: m_teams.add(m["away_registration_id"])
                if m["bracket_id"] and not m_teams:
                    m_teams = self._get_possible_teams_for_bracket(supabase, m["id"])
                    
                if m_teams.intersection(current_preceding_teams):
                    continue
                    
                # Try this match
                next_remaining = [x for x in remaining_matches if x["id"] != m["id"]]
                # In this simplified simulation we assume 1 field per slot for the sequence check
                # For robust multi-field we'd need to simulate the exact slot structure.
                # Here we just use a heuristic: if we can chain them, it's good.
                if can_complete_schedule(m_teams, next_remaining, slots_to_fill - 1):
                    return True
            return False
            
        selected = None
        for candidate in valid_candidates:
            c_teams = set()
            if candidate["home_registration_id"]: c_teams.add(candidate["home_registration_id"])
            if candidate["away_registration_id"]: c_teams.add(candidate["away_registration_id"])
            if candidate["bracket_id"] and not c_teams:
                c_teams = self._get_possible_teams_for_bracket(supabase, candidate["id"])
                
            remaining_unassigned = [m for m in unassigned if m["id"] != candidate["id"]]
            
            depth = len(remaining_unassigned)
            if can_complete_schedule(c_teams, remaining_unassigned, depth):
                selected = candidate
                break
                
        if not selected:
            # Fallback to the first valid one if simulation failed or we couldn't find a perfect path
            selected = valid_candidates[0]
        
        supabase.table("slot_field_assignments").update({
            "fixture_id": selected["id"]
        }).eq("id", target_assignment["id"]).execute()
        
        supabase.table("matches").update({
            "scheduling_status": "ASSIGNED",
            "scheduled_start": target_slot["scheduled_start"],
            "venue_field_id": target_assignment["venue_field_id"]
        }).eq("id", selected["id"]).execute()
        
        supabase.table("schedule_slots").update({
            "status": "PARTIALLY_ASSIGNED"
        }).eq("id", target_slot["id"]).execute()

        response_snapshot = {"assigned_fixture": selected["id"], "slot_field_assignment": target_assignment["id"]}
        IdempotencyService.save_idempotency(payload.idempotency_key, actor_id, event_id, "GENERATE_NEXT_SLOT", response_snapshot)
        return response_snapshot
        
    async def override_schedule(self, event_id: UUID, payload: ScheduleOverrideRequest) -> dict:
        supabase = get_service_supabase()
        
        match_res = supabase.table("matches").select("status, scheduling_status").eq("id", str(payload.fixture_id)).execute()
        if not match_res.data or match_res.data[0]["status"] != "SCHEDULED" or match_res.data[0]["scheduling_status"] != "ASSIGNED":
            raise HTTPException(status_code=400, detail="Cannot override a started, completed, or unassigned match")
            
        return {"success": True}
        
    async def unassign_fixture(self, event_id: UUID, payload: ScheduleUnassignRequest) -> dict:
        supabase = get_service_supabase()
        
        # Verify the match is assigned
        match_res = supabase.table("matches").select("status, scheduling_status").eq("id", str(payload.fixture_id)).execute()
        if not match_res.data:
            raise HTTPException(status_code=404, detail="Match not found")
        if match_res.data[0]["scheduling_status"] != "ASSIGNED":
            raise HTTPException(status_code=400, detail="Match is not assigned")
            
        # Update match to UNASSIGNED
        supabase.table("matches").update({
            "scheduling_status": "UNASSIGNED",
            "scheduled_start": None,
            "venue_field_id": None
        }).eq("id", str(payload.fixture_id)).execute()
        
        # Free up the slot_field_assignment
        assignment_res = supabase.table("slot_field_assignments").update({
            "fixture_id": None
        }).eq("fixture_id", str(payload.fixture_id)).execute()
        
        # Note: We technically should re-evaluate schedule_slots.status to see if it is still PARTIALLY_ASSIGNED or EMPTY
        # But for Phase 3, this is acceptable.
            
        return {"success": True}

    async def generate_fixtures(self, event_id: UUID, payload: GenerateFixturesRequest, actor_id: UUID) -> dict:
        cached = IdempotencyService.check_idempotency(payload.idempotency_key, event_id, "GENERATE_FIXTURES")
        if cached:
            return cached

        supabase = get_service_supabase()
        
        # 1. Fetch Event settings
        event_res = supabase.table("events").select("scheduling_state").eq("id", str(event_id)).execute()
        if not event_res.data:
            raise HTTPException(status_code=404, detail="Event not found")
        
        existing_matches = supabase.table("matches").select("id").eq("event_id", str(event_id)).limit(1).execute()
        if existing_matches.data:
            raise HTTPException(status_code=400, detail="Fixtures have already been generated for this event")
            
        settings_res = supabase.table("event_settings").select("tournament_format").eq("event_id", str(event_id)).execute()
        tournament_format = settings_res.data[0]["tournament_format"] if settings_res.data else None
        
        if tournament_format != "ROUND_ROBIN":
            raise HTTPException(status_code=400, detail="Only ROUND_ROBIN tournament format is supported for auto-generation currently")
            
        # 2. Fetch approved teams
        teams_res = supabase.table("event_team_registrations")\
            .select("id")\
            .eq("event_id", str(event_id))\
            .eq("status", "APPROVED")\
            .execute()
            
        teams = [t["id"] for t in teams_res.data]
        if len(teams) < 2:
            raise HTTPException(status_code=400, detail="At least 2 approved teams are required to generate fixtures")
            
        # 3. Generate Round-Robin Pairs (Circle Method)
        if len(teams) % 2 != 0:
            teams.append(None) # Bye
            
        n = len(teams)
        matches_to_insert = []
        
        for round_idx in range(n - 1):
            for i in range(n // 2):
                home = teams[i]
                away = teams[n - 1 - i]
                
                if home is not None and away is not None:
                    matches_to_insert.append({
                        "event_id": str(event_id),
                        "home_registration_id": home,
                        "away_registration_id": away,
                        "status": "SCHEDULED", # Phase 4 Lifecycle status
                        "scheduling_status": "UNASSIGNED",
                        "scheduled_start": None,
                        "venue_field_id": None
                    })
                    
            # Rotate
            teams.insert(1, teams.pop())
            
        if not matches_to_insert:
            raise HTTPException(status_code=400, detail="No fixtures generated")
            
        # Delete existing UNASSIGNED matches to allow safe regeneration before LIVE
        supabase.table("matches").delete().eq("event_id", str(event_id)).eq("scheduling_status", "UNASSIGNED").execute()
        
        # Insert new matches sequentially to ensure strict created_at ordering
        # This is critical for the greedy scheduler to naturally follow the round-robin sequence
        res_data = []
        for m in matches_to_insert:
            r = supabase.table("matches").insert(m).execute()
            res_data.extend(r.data)
        
        response_payload = {
            "success": True,
            "fixture_count": len(res_data),
            "message": f"Successfully generated {len(res_data)} fixtures"
        }
        
        IdempotencyService.save_idempotency(payload.idempotency_key, actor_id, event_id, "GENERATE_FIXTURES", response_payload)
        return response_payload

    async def update_broadcast_state(self, event_id: UUID, state: str, user_id: UUID):
        supabase = get_service_supabase()
        role_res = supabase.table('event_roles').select('role').eq('event_id', str(event_id)).eq('user_id', str(user_id)).execute()
        if not role_res.data or role_res.data[0]['role'] not in ['EVENT_OWNER', 'EVENT_ADMIN']:
            raise HTTPException(status_code=403, detail='Not authorized')
        supabase.table('events').update({'scheduling_state': state}).eq('id', str(event_id)).execute()
        return {'success': True}

scheduling_service = SchedulingService()
