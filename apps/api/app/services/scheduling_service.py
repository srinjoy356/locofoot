import json
from uuid import UUID
from datetime import datetime
from fastapi import HTTPException
from typing import List, Set, Dict, Any
from app.core.supabase_client import get_service_supabase
from app.schemas.scheduling import ScheduleNextRequest, ScheduleOverrideRequest, ScheduleUnassignRequest
from app.services.idempotency_service import IdempotencyService

class SchedulingService:

    @staticmethod
    def _possible_teams(supabase, match: dict, cache: Dict[str, Set[str]]) -> Set[str]:
        """Every registration that could end up playing `match`, following bracket sources backwards."""
        if match["id"] in cache:
            return cache[match["id"]]
        teams: Set[str] = {t for t in (match["home_registration_id"], match["away_registration_id"]) if t}
        cache[match["id"]] = teams  # also guards against cycles
        if match["bracket_id"]:
            b = supabase.table("brackets").select("home_source, away_source").eq("id", match["bracket_id"]).execute().data
            for src in (b[0]["home_source"], b[0]["away_source"]) if b else ():
                if src.get("type") in ("winner_of", "loser_of") and src.get("match_id"):
                    prev = supabase.table("matches").select("*").eq("id", src["match_id"]).execute().data
                    if prev:
                        teams |= SchedulingService._possible_teams(supabase, prev[0], cache)
                elif src.get("type") == "group_position":
                    regs = supabase.table("event_team_registrations").select("id").eq("group_id", src["group_id"]).execute().data
                    teams |= {r["id"] for r in regs}
        return teams

    @staticmethod
    def _prerequisites_scheduled(supabase, match: dict, slot_start: str) -> bool:
        """A knockout game is only placeable once the games that decide its teams sit in an earlier slot."""
        if not match["bracket_id"]:
            return True
        b = supabase.table("brackets").select("home_source, away_source").eq("id", match["bracket_id"]).execute().data
        if not b:
            return True
        needed = []
        for src in (b[0]["home_source"], b[0]["away_source"]):
            if src.get("type") in ("winner_of", "loser_of"):
                needed += supabase.table("matches").select("scheduling_status, scheduled_start").eq("id", src["match_id"]).execute().data
            elif src.get("type") == "group_position":
                needed += supabase.table("matches").select("scheduling_status, scheduled_start") \
                    .eq("group_id", src["group_id"]).is_("bracket_id", "null").execute().data
        return all(n["scheduling_status"] == "ASSIGNED" and n["scheduled_start"] < slot_start for n in needed)

    async def generate_next_slot(self, event_id: UUID, payload: ScheduleNextRequest, actor_id: UUID) -> dict:
        cached = IdempotencyService.check_idempotency(payload.idempotency_key, event_id, "GENERATE_NEXT_SLOT")
        if cached:
            return cached

        supabase = get_service_supabase()

        event_res = supabase.table("events").select("scheduling_state, slot_structure_state").eq("id", str(event_id)).execute()
        if not event_res.data or event_res.data[0]["scheduling_state"] != "LIVE":
            raise HTTPException(status_code=400, detail="Event is not in LIVE scheduling state")

        empty_assignments = supabase.table("slot_field_assignments") \
            .select("*, schedule_slots!inner(*)") \
            .is_("fixture_id", "null") \
            .eq("schedule_slots.event_id", str(event_id)) \
            .order("schedule_slots(sequence_number)", desc=False) \
            .execute().data

        if not empty_assignments:
            raise HTTPException(status_code=400, detail="No empty slots remaining")

        unassigned = supabase.table("matches").select("*") \
            .eq("event_id", str(event_id)).eq("scheduling_status", "UNASSIGNED").order("created_at").execute().data
        if not unassigned:
            raise HTTPException(status_code=400, detail="No unassigned fixtures available")

        teams_cache: Dict[str, Set[str]] = {}
        teams_of = lambda m: self._possible_teams(supabase, m, teams_cache)

        # Take the first empty field that has a placeable fixture. A knockout game can be blocked for one field
        # (its feeder shares the slot) yet fit the next slot.
        target_assignment = target_slot = candidates = None
        definite = lambda m: {t for t in (m["home_registration_id"], m["away_registration_id"]) if t}
        for assignment in empty_assignments:
            slot = assignment["schedule_slots"]
            # one team cannot play on two pitches at the same time
            busy: Set[str] = set()
            for row in supabase.table("slot_field_assignments").select("fixture_id").eq("schedule_slot_id", slot["id"]).not_.is_("fixture_id", "null").execute().data:
                fx = supabase.table("matches").select("home_registration_id, away_registration_id").eq("id", row["fixture_id"]).execute().data
                busy |= definite(fx[0]) if fx else set()
            ready = [m for m in unassigned if not definite(m) & busy and self._prerequisites_scheduled(supabase, m, slot["scheduled_start"])]
            if ready:
                target_assignment, target_slot, candidates = assignment, slot, ready
                break
        if not target_assignment:
            raise HTTPException(status_code=400, detail="No fixture can be placed yet: knockout games must follow the games that decide their teams. Add more slots or assign earlier fixtures first.")

        target_seq = target_slot["sequence_number"]
        preceding_teams: Set[str] = set()
        if target_seq > 1:
            prev_slot_res = supabase.table("schedule_slots").select("id").eq("event_id", str(event_id)).eq("sequence_number", target_seq - 1).execute()
            if prev_slot_res.data:
                prev = supabase.table("slot_field_assignments").select("fixture_id") \
                    .eq("schedule_slot_id", prev_slot_res.data[0]["id"]).not_.is_("fixture_id", "null").execute()
                for row in prev.data:
                    fix_res = supabase.table("matches").select("*").eq("id", row["fixture_id"]).execute()
                    if fix_res.data:
                        preceding_teams |= teams_of(fix_res.data[0])

        valid_candidates = [m for m in candidates if not teams_of(m) & preceding_teams]
        if not valid_candidates:
            # Back-to-back is mathematically unavoidable here; allow it rather than stall the schedule
            valid_candidates = candidates

        # Prefer a candidate that does not lead to a dead end, via a bounded DFS over what is left.
        budget = [20000]

        def can_complete_schedule(current_preceding_teams, remaining_matches):
            if not remaining_matches or budget[0] <= 0:
                return True
            budget[0] -= 1
            for m in remaining_matches:
                m_teams = teams_of(m)
                if m_teams & current_preceding_teams:
                    continue
                if can_complete_schedule(m_teams, [x for x in remaining_matches if x["id"] != m["id"]]):
                    return True
            return False

        selected = next(
            (c for c in valid_candidates
             if can_complete_schedule(teams_of(c), [m for m in unassigned if m["id"] != c["id"]])),
            valid_candidates[0],
        )

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
        # The request schema exists but moving a fixture between slots was never built; do not pretend it worked.
        raise HTTPException(status_code=501, detail="Moving a fixture to another slot is not supported yet. Unassign it and generate the next slot instead.")

    async def unassign_fixture(self, event_id: UUID, payload: ScheduleUnassignRequest) -> dict:
        supabase = get_service_supabase()

        match_res = supabase.table("matches").select("event_id, match_state, scheduling_status").eq("id", str(payload.fixture_id)).execute()
        if not match_res.data or match_res.data[0]["event_id"] != str(event_id):
            raise HTTPException(status_code=404, detail="Match not found")
        match = match_res.data[0]
        if match["scheduling_status"] != "ASSIGNED":
            raise HTTPException(status_code=400, detail="Match is not assigned")
        if match["match_state"] != "SCHEDULED":
            raise HTTPException(status_code=400, detail="A match that has started cannot be unassigned")

        supabase.table("matches").update({
            "scheduling_status": "UNASSIGNED",
            "scheduled_start": None,
            "venue_field_id": None
        }).eq("id", str(payload.fixture_id)).execute()

        slot_ids = [r["schedule_slot_id"] for r in supabase.table("slot_field_assignments")
                    .update({"fixture_id": None}).eq("fixture_id", str(payload.fixture_id)).execute().data]

        # a slot with no fixture left goes back to EMPTY
        for slot_id in set(slot_ids):
            left = supabase.table("slot_field_assignments").select("id").eq("schedule_slot_id", slot_id).not_.is_("fixture_id", "null").limit(1).execute().data
            if not left:
                supabase.table("schedule_slots").update({"status": "EMPTY"}).eq("id", slot_id).execute()

        return {"success": True}

    async def update_broadcast_state(self, event_id: UUID, state: str, user_id: UUID):
        supabase = get_service_supabase()
        role_res = supabase.table('event_roles').select('role').eq('event_id', str(event_id)).eq('user_id', str(user_id)).execute()
        if not role_res.data or role_res.data[0]['role'] not in ['EVENT_OWNER', 'EVENT_ADMIN']:
            raise HTTPException(status_code=403, detail='Not authorized')
        supabase.table('events').update({'scheduling_state': state}).eq('id', str(event_id)).execute()
        return {'success': True}

    async def create_manual_match(self, event_id: UUID, payload: Any, actor_id: UUID) -> dict:
        cached = IdempotencyService.check_idempotency(payload.idempotency_key, event_id, "CREATE_MANUAL_MATCH")
        if cached:
            return cached

        supabase = get_service_supabase()
        
        # 1. Fetch and validate the slot assignment
        assignment_res = supabase.table("slot_field_assignments")\
            .select("*, schedule_slots(*)")\
            .eq("id", str(payload.slot_assignment_id)).execute()
            
        if not assignment_res.data:
            raise HTTPException(status_code=404, detail="Slot assignment not found")
            
        assignment = assignment_res.data[0]
        if assignment.get("fixture_id"):
            raise HTTPException(status_code=400, detail="Slot is already occupied")
            
        slot = assignment["schedule_slots"]
        if slot["event_id"] != str(event_id):
            raise HTTPException(status_code=400, detail="Slot belongs to a different event")
        
        # 2. Insert the manual match
        match_data = {
            "event_id": str(event_id),
            "home_registration_id": str(payload.home_registration_id) if payload.home_registration_id else None,
            "away_registration_id": str(payload.away_registration_id) if payload.away_registration_id else None,
            "status": "SCHEDULED",
            "scheduling_status": "ASSIGNED",
            "scheduled_start": slot["scheduled_start"],
            "venue_field_id": assignment["venue_field_id"],
            "group_id": str(payload.group_id) if payload.group_id else None,
            "bracket_id": str(payload.bracket_id) if payload.bracket_id else None,
            "metadata": payload.metadata if payload.metadata else {}
        }
        
        r = supabase.table("matches").insert(match_data).execute()
        
        if not r.data:
            raise HTTPException(status_code=500, detail="Failed to create manual match")
            
        match_id = r.data[0]["id"]
        
        # 3. Update slot_field_assignments
        supabase.table("slot_field_assignments").update({
            "fixture_id": match_id
        }).eq("id", assignment["id"]).execute()
        
        # 4. Update schedule_slots status
        supabase.table("schedule_slots").update({
            "status": "PARTIALLY_ASSIGNED"  # Optimistic update, it could be FULLY_ASSIGNED but PARTIALLY is safer for Phase 3
        }).eq("id", slot["id"]).execute()
        
        response_payload = {
            "success": True,
            "match_id": match_id,
            "message": "Manual match created successfully"
        }
        
        IdempotencyService.save_idempotency(payload.idempotency_key, actor_id, event_id, "CREATE_MANUAL_MATCH", response_payload)
        return response_payload

scheduling_service = SchedulingService()
