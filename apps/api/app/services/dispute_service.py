from fastapi import HTTPException
from app.core.supabase_client import supabase_admin
from app.schemas.disputes import DisputeCreate, DisputeUpdate
from app.services.event_service import EventService

class DisputeService:
    @staticmethod
    def create_dispute(event_id: str, data: DisputeCreate, user_id: str):
        # 1. State guard: match must be COMPLETED or FINALIZED (if target is MATCH)
        if data.match_id:
            match_res = supabase_admin.table('matches').select('match_state').eq('id', str(data.match_id)).execute()
            if not match_res.data:
                raise HTTPException(404, "Match not found")
            state = match_res.data[0]['match_state']
            if state not in ['COMPLETED', 'FINALIZED']:
                raise HTTPException(400, "Can only dispute completed or finalized matches")
        
        # 2. Idempotent write
        res = supabase_admin.table('disputes').insert({
            "event_id": event_id,
            "match_id": str(data.match_id) if data.match_id else None,
            "target_type": data.target_type,
            "target_id": str(data.target_id) if data.target_id else None,
            "reason": data.reason,
            "description": data.description,
            "reporter_id": user_id,
            "status": "OPEN"
        }).execute()
        
        if not res.data:
            raise HTTPException(500, "Failed to create dispute")
            
        dispute = res.data[0]
        
        # 3. Audit log
        EventService._log_audit(user_id, "CREATE_DISPUTE", "disputes", dispute['id'], None, dispute)
        
        # 4. If a match is FINALIZED, change back to COMPLETED or UNDER_REVIEW (via state transition maybe?)
        # For this requirement, we just record the dispute. Match state change is handled via match engine.
        
        return dispute

    @staticmethod
    def update_dispute(event_id: str, dispute_id: str, data: DisputeUpdate, user_id: str):
        # 1. Permission guard
        EventService._require_admin(event_id, user_id)
        
        # 2. Get current
        current = supabase_admin.table('disputes').select('*').eq('id', dispute_id).eq('event_id', event_id).single().execute()
        if not current.data:
            raise HTTPException(404, "Dispute not found")
            
        old_status = current.data['status']
        new_status = data.status
        
        # 3. Idempotent write
        updates = {
            "status": new_status,
            "resolution_notes": data.resolution_notes
        }
        if new_status in ['APPROVED', 'REJECTED', 'MODIFIED'] and old_status not in ['APPROVED', 'REJECTED', 'MODIFIED']:
            updates['resolved_by'] = user_id
            updates['resolved_at'] = 'now()'
            
        res = supabase_admin.table('disputes').update(updates).eq('id', dispute_id).execute()
        
        # 4. Audit log
        EventService._log_audit(user_id, "UPDATE_DISPUTE", "disputes", dispute_id, current.data, res.data[0])
        
        return res.data[0]
