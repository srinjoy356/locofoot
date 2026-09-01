from typing import Dict, Any, Optional
from uuid import UUID
from fastapi import HTTPException
from supabase import AsyncClient
from ..schemas.match_operations import (
    MatchState,
    StateTransitionRequest,
    RefereeEventRequest,
    TimelineEventRequest,
    CorrectionRequest
)

class MatchEngineService:
    def __init__(self, db: AsyncClient):
        self.db = db

    async def _initialize_match_participation(self, match_id: UUID, start_time: str):
        # Fetch confirmed lineups
        lineups = await self.db.table("match_lineups").select("id, team_registration_id").eq("match_id", str(match_id)).eq("status", "CONFIRMED").execute()
        if not lineups.data:
            return
            
        participation_inserts = []
        for lineup in lineups.data:
            players_res = await self.db.table("match_lineup_players").select("event_team_player_id, lineup_role").eq("lineup_id", lineup["id"]).execute()
            for p in players_res.data:
                participation_inserts.append({
                    "match_id": str(match_id),
                    "event_registration_id": lineup["team_registration_id"],
                    "event_player_id": p["event_team_player_id"],
                    "status": p["lineup_role"],
                    "entry_elapsed_seconds": 0 if p["lineup_role"] == "STARTER" else None,
                    "exit_elapsed_seconds": None
                })
                
        if participation_inserts:
            # Delete any existing to be safe
            await self.db.table("match_participation").delete().eq("match_id", str(match_id)).execute()
            await self.db.table("match_participation").insert(participation_inserts).execute()

    async def transition_state(self, match_id: UUID, actor_id: UUID, req: StateTransitionRequest) -> Dict[str, Any]:
        from datetime import datetime, timezone
        
        # 1. Fetch match and check if allowed
        res = await self.db.table("matches").select("match_state, half_started_at, paused_at").eq("id", str(match_id)).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Match not found")
        
        match_data = res.data[0]
        current_state = match_data["match_state"]
        
        now = datetime.now(timezone.utc).isoformat()
        updates = {"match_state": req.new_state.value}
        
        # 2. Handle Timestamps for Time Tracking
        if req.new_state.value in ["LIVE", "FIRST_HALF", "SECOND_HALF", "EXTRA_TIME_1", "EXTRA_TIME_2"]:
            if current_state in ["SCHEDULED", "PRE_MATCH", "READY"] or not match_data.get("half_started_at"):
                # Match is starting for the very first time, or somehow half_started_at was missing
                updates["match_started_at"] = now
                updates["half_started_at"] = now
                
                # [NEW] INITIALIZE MATCH PARTICIPATION FROM CONFIRMED LINEUPS
                # Run this lazily only on first start
                if current_state in ["SCHEDULED", "PRE_MATCH", "READY"]:
                    await self._initialize_match_participation(match_id, now)

            elif current_state == "HALF_TIME":
                # Starting second half
                updates["half_started_at"] = now
            elif current_state == "PAUSED":
                # Resuming from a pause. We shift the half_started_at forward by the duration of the pause
                # so that elapsed time calculation (now - half_started_at) remains accurate.
                updates["resumed_at"] = now
                if match_data.get("paused_at") and match_data.get("half_started_at"):
                    paused_at = datetime.fromisoformat(match_data["paused_at"].replace('Z', '+00:00'))
                    half_started_at = datetime.fromisoformat(match_data["half_started_at"].replace('Z', '+00:00'))
                    pause_duration = datetime.now(timezone.utc) - paused_at
                    new_half_started_at = half_started_at + pause_duration
                    updates["half_started_at"] = new_half_started_at.isoformat()
                    
        elif req.new_state.value in ["PAUSED", "HALF_TIME", "FULL_TIME", "COMPLETED"]:
            updates["paused_at"] = now
            
            # [NEW] Cap match participation at full time
            if req.new_state.value in ["FULL_TIME", "COMPLETED"] and current_state not in ["FULL_TIME", "COMPLETED"]:
                # We need to know the total elapsed seconds. For simplicity, we can rely on 
                # a frontend-provided final elapsed_seconds, but the schema doesn't have it.
                # Since we don't have exact elapsed_seconds in StateTransitionRequest, we just set it based on clock.
                # However, since the stats view can calculate minutes based on entry/exit, setting exit to max 
                # (e.g. 5400 for 90 mins) or just fetching the last timeline event's elapsed_seconds.
                # For now, we will query the max elapsed_seconds.
                max_res = await self.db.table("match_timeline_events").select("elapsed_seconds").eq("match_id", str(match_id)).order("elapsed_seconds", desc=True).limit(1).execute()
                final_seconds = max_res.data[0]["elapsed_seconds"] if max_res.data else 0
                await self.db.table("match_participation").update({
                    "exit_elapsed_seconds": final_seconds
                }).eq("match_id", str(match_id)).is_("exit_elapsed_seconds", "null").execute()

        # 3. Update match state and timestamps
        await self.db.table("matches").update(updates).eq("id", str(match_id)).execute()
        
        # [NEW] Phase 5: Trigger Ratings and MVP calculation on COMPLETED
        if req.new_state.value == "COMPLETED" and current_state != "COMPLETED":
            try:
                await self.db.rpc("compute_match_ratings_and_mvp", {"p_match_id": str(match_id)}).execute()
            except Exception as e:
                print(f"Failed to compute match ratings: {e}")
        
        # 4. Insert transition log
        try:
            await self.db.table("match_state_transitions").insert({
                "id": str(req.idempotency_key),
                "match_id": str(match_id),
                "previous_state": current_state,
                "new_state": req.new_state.value,
                "reason": req.reason,
                "actor_id": str(actor_id)
            }).execute()
        except Exception:
            pass # ignore idempotency conflicts
            
        return {"status": "success", "new_state": req.new_state}


    async def _upsert_participation(self, match_id: str, event_player_id: str, event_registration_id: str, updates: dict):
        # We try to update first
        query = self.db.table("match_participation").update(updates).eq("match_id", match_id).eq("event_player_id", event_player_id)
        # Apply conditions if any
        if "exit_elapsed_seconds" in updates and updates.get("exit_elapsed_seconds") is not None:
            # We are setting exit, so make sure it was null
            query = query.is_("exit_elapsed_seconds", "null")
        elif "entry_elapsed_seconds" in updates and updates.get("entry_elapsed_seconds") is not None:
            # We are setting entry, so make sure it was null
            query = query.is_("entry_elapsed_seconds", "null")
            
        res = await query.execute()
        
        # If no row updated, we must insert
        if not res.data:
            insert_data = {
                "match_id": match_id,
                "event_player_id": event_player_id,
                "event_registration_id": event_registration_id,
                "status": updates.get("status", "DID_NOT_PLAY")
            }
            if "entry_elapsed_seconds" in updates:
                insert_data["entry_elapsed_seconds"] = updates["entry_elapsed_seconds"]
            if "exit_elapsed_seconds" in updates:
                insert_data["exit_elapsed_seconds"] = updates["exit_elapsed_seconds"]
            try:
                await self.db.table("match_participation").insert(insert_data).execute()
            except Exception:
                pass # Ignore if unique constraint violation or something else

    async def record_referee_event(self, match_id: UUID, actor_id: UUID, req: RefereeEventRequest) -> Dict[str, Any]:
        try:
            await self.db.table("referee_events").insert({
                "id": str(req.id),
                "match_id": str(match_id),
                "event_type": req.event_type.value,
                "period": req.period.value,
                "elapsed_seconds": req.elapsed_seconds,
                "display_minute": req.display_minute,
                "display_second": req.display_second,
                "created_by": str(actor_id),
                "event_player_id": str(req.event_player_id) if req.event_player_id else None,
                "event_registration_id": str(req.event_registration_id) if req.event_registration_id else None,
                "target_player_id": str(req.target_player_id) if req.target_player_id else None,
                "metadata": req.metadata
            }).execute()
            
            # [NEW] Handle Participation on Substitution
            if req.event_type.value == "SUBSTITUTION" and req.event_player_id and req.metadata.get("player_in_id"):
                # Outgoing player (event_player_id)
                await self._upsert_participation(str(match_id), str(req.event_player_id), str(req.event_registration_id), {
                    "exit_elapsed_seconds": req.elapsed_seconds,
                    "status": "SUBBED_OUT"
                })
                
                # Incoming player (player_in_id)
                await self._upsert_participation(str(match_id), req.metadata["player_in_id"], str(req.event_registration_id), {
                    "entry_elapsed_seconds": req.elapsed_seconds,
                    "status": "SUBBED_IN"
                })

            # [NEW] Handle Red Card / Second Yellow Card
            if req.event_type.value == "RED_CARD" and req.event_player_id:
                await self._upsert_participation(str(match_id), str(req.event_player_id), str(req.event_registration_id), {
                    "exit_elapsed_seconds": req.elapsed_seconds,
                    "status": "SENT_OFF"
                })

            if req.event_type.value == "YELLOW_CARD" and req.event_player_id:
                yellows_res = await self.db.table("referee_events").select("id").eq("match_id", str(match_id)).eq("event_player_id", str(req.event_player_id)).eq("event_type", "YELLOW_CARD").execute()
                if yellows_res.data and len(yellows_res.data) >= 2:
                    import uuid
                    red_card_id = str(uuid.uuid4())
                    await self.db.table("referee_events").insert({
                        "id": red_card_id,
                        "match_id": str(match_id),
                        "event_type": "RED_CARD",
                        "period": req.period.value,
                        "elapsed_seconds": req.elapsed_seconds,
                        "display_minute": req.display_minute,
                        "display_second": req.display_second,
                        "created_by": str(actor_id),
                        "event_player_id": str(req.event_player_id),
                        "event_registration_id": str(req.event_registration_id) if req.event_registration_id else None,
                        "target_player_id": None,
                        "metadata": {"reason": "Second Yellow Card"}
                    }).execute()
                    
                    await self._upsert_participation(str(match_id), str(req.event_player_id), str(req.event_registration_id), {
                        "exit_elapsed_seconds": req.elapsed_seconds,
                        "status": "SENT_OFF"
                    })
                
        except Exception as e:
            pass # idempotent
        
        return {"status": "success", "event_id": str(req.id)}

    async def record_timeline_event(self, match_id: UUID, actor_id: UUID, req: TimelineEventRequest) -> Dict[str, Any]:
        try:
            await self.db.table("match_timeline_events").insert({
                "id": str(req.id),
                "match_id": str(match_id),
                "event_type": req.event_type.value,
                "period": req.period.value,
                "elapsed_seconds": req.elapsed_seconds,
                "display_minute": req.display_minute,
                "display_second": req.display_second,
                "actor_player_id": str(req.actor_player_id) if req.actor_player_id else None,
                "actor_registration_id": str(req.actor_registration_id) if req.actor_registration_id else None,
                "target_player_id": str(req.target_player_id) if req.target_player_id else None,
                "target_registration_id": str(req.target_registration_id) if req.target_registration_id else None,
                "x": req.x,
                "y": req.y,
                "referee_event_id": str(req.referee_event_id) if req.referee_event_id else None,
                "is_big_chance": req.is_big_chance,
                "related_event_id": str(req.related_event_id) if req.related_event_id else None,
                "assist_player_id": str(req.assist_player_id) if req.assist_player_id else None,
                "assist_event_id": str(req.assist_event_id) if req.assist_event_id else None,
                "second_assist_player_id": str(req.second_assist_player_id) if req.second_assist_player_id else None,
                "second_assist_event_id": str(req.second_assist_event_id) if req.second_assist_event_id else None,
                "metadata": req.metadata,
                "created_by": str(actor_id)
            }).execute()
        except Exception:
            pass # idempotent
        
        return {"status": "success", "event_id": str(req.id)}

    async def correct_timeline_event(self, match_id: UUID, actor_id: UUID, req: CorrectionRequest) -> Dict[str, Any]:
        # 1. Fetch original
        row = await self.db.table("match_timeline_events").select("metadata").eq("id", str(req.timeline_event_id)).eq("match_id", str(match_id)).execute()
        
        if not row.data:
            raise HTTPException(status_code=404, detail="Timeline event not found")
            
        original_payload = row.data[0]["metadata"]
        
        # 2. Insert into event_corrections
        try:
            await self.db.table("event_corrections").insert({
                "id": str(req.idempotency_key),
                "match_id": str(match_id),
                "timeline_event_id": str(req.timeline_event_id),
                "original_payload": original_payload,
                "corrected_payload": req.corrected_payload,
                "reason": req.reason,
                "corrected_by": str(actor_id)
            }).execute()
        except Exception:
            pass
            
        # 3. Update the timeline metadata in place
        await self.db.table("match_timeline_events").update({
            "metadata": req.corrected_payload
        }).eq("id", str(req.timeline_event_id)).execute()
        
        # 4. If the match is already COMPLETED, re-trigger rating/MVP calculation
        match_res = await self.db.table("matches").select("match_state").eq("id", str(match_id)).execute()
        if match_res.data and match_res.data[0]["match_state"] == "COMPLETED":
            try:
                await self.db.rpc("compute_match_ratings_and_mvp", {"p_match_id": str(match_id)}).execute()
            except Exception as e:
                print(f"Failed to recompute match ratings on correction: {e}")
        
        return {"status": "success"}

    async def correct_referee_event(self, match_id: UUID, actor_id: UUID, req: CorrectionRequest) -> Dict[str, Any]:
        # 1. Fetch original
        row = await self.db.table("referee_events").select("*").eq("id", str(req.timeline_event_id)).eq("match_id", str(match_id)).execute()
        
        if not row.data:
            raise HTTPException(status_code=404, detail="Referee event not found")
            
        original_event = row.data[0]
        original_payload = original_event["metadata"]
        
        # 2. Insert into event_corrections
        try:
            await self.db.table("event_corrections").insert({
                "id": str(req.idempotency_key),
                "match_id": str(match_id),
                "timeline_event_id": str(req.timeline_event_id),
                "original_payload": original_payload,
                "corrected_payload": req.corrected_payload,
                "reason": req.reason,
                "corrected_by": str(actor_id)
            }).execute()
        except Exception:
            pass
            
        # 3. Update the timeline metadata in place
        await self.db.table("referee_events").update({
            "metadata": req.corrected_payload
        }).eq("id", str(req.timeline_event_id)).execute()
        
        # 4. If we are marking it as deleted, undo participation changes
        if req.corrected_payload.get("deleted"):
            event_type = original_event["event_type"]
            event_player_id = original_event["event_player_id"]
            
            if event_type == "SUBSTITUTION" and event_player_id and original_payload.get("player_in_id"):
                # Revert outgoing player
                await self.db.table("match_participation").update({
                    "exit_elapsed_seconds": None,
                    "status": "SUBBED_IN" # Simplifying assuming they were subbed in, or maybe starter. But subbed in is safe to allow them to be active again
                }).eq("match_id", str(match_id)).eq("event_player_id", event_player_id).execute()
                
                # Revert incoming player
                await self.db.table("match_participation").update({
                    "entry_elapsed_seconds": None,
                    "status": "SUBSTITUTE"
                }).eq("match_id", str(match_id)).eq("event_player_id", original_payload["player_in_id"]).execute()
            
            elif event_type == "RED_CARD" and event_player_id:
                await self.db.table("match_participation").update({
                    "exit_elapsed_seconds": None,
                    "status": "SUBBED_IN" # Simplifying assumption to reactivate them
                }).eq("match_id", str(match_id)).eq("event_player_id", event_player_id).execute()
                
            elif event_type == "YELLOW_CARD" and event_player_id:
                # If a yellow card is deleted, we might have generated a red card automatically.
                # In a real app we'd delete the cascade, but for now just let the referee also undo the red card manually.
                pass
        
        return {"status": "success"}

    async def submit_lineup(self, match_id: UUID, team_registration_id: UUID, actor_id: UUID, players: list) -> Dict[str, Any]:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        
        # 1. Fetch current lineup version
        res = await self.db.table("match_lineups").select("*").eq("match_id", str(match_id)).eq("team_registration_id", str(team_registration_id)).execute()
        
        if not res.data:
            # Create new
            lineup_res = await self.db.table("match_lineups").insert({
                "match_id": str(match_id),
                "team_registration_id": str(team_registration_id),
                "version": 1,
                "status": "SUBMITTED",
                "submitted_by": str(actor_id),
                "submitted_at": now
            }).execute()
            lineup_id = lineup_res.data[0]["id"]
        else:
            lineup = res.data[0]
            lineup_id = lineup["id"]
            new_version = lineup["version"] + 1
            
            # Update lineup status
            await self.db.table("match_lineups").update({
                "version": new_version,
                "status": "SUBMITTED",
                "submitted_by": str(actor_id),
                "submitted_at": now,
                "changed_by": str(actor_id),
                "changed_at": now
            }).eq("id", lineup_id).execute()
            
            # Delete old players
            await self.db.table("match_lineup_players").delete().eq("lineup_id", lineup_id).execute()
            
        # 2. Insert players
        player_inserts = []
        for p in players:
            player_inserts.append({
                "lineup_id": lineup_id,
                "event_team_player_id": str(p.event_team_player_id),
                "lineup_role": p.lineup_role.value
            })
            
        if player_inserts:
            await self.db.table("match_lineup_players").insert(player_inserts).execute()
            
        return {"status": "success", "lineup_id": lineup_id}

    async def confirm_lineup(self, match_id: UUID, team_registration_id: UUID, actor_id: UUID) -> Dict[str, Any]:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        
        res = await self.db.table("match_lineups").update({
            "status": "CONFIRMED",
            "confirmed_by": str(actor_id),
            "confirmed_at": now
        }).eq("match_id", str(match_id)).eq("team_registration_id", str(team_registration_id)).execute()
        
        return {"status": "success"}
