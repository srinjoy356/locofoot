from fastapi import HTTPException
from app.core.supabase_client import supabase_admin
from app.schemas.announcements import AnnouncementCreate
from app.services.event_service import EventService

class AnnouncementService:
    @staticmethod
    def create_announcement(event_id: str, data: AnnouncementCreate, user_id: str):
        # State guard: Event must exist (implicit by FK, but let's just check admin)
        # Permission guard: Event admin
        EventService._require_admin(event_id, user_id)
        
        # Idempotent write is not strictly required here if it's a manual action without an idempotency key, 
        # but we just insert the announcement.
        res = supabase_admin.table('event_announcements').insert({
            "event_id": event_id,
            "author_id": user_id,
            "message": data.message,
            "is_emergency": data.is_emergency
        }).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create announcement")
            
        announcement = res.data[0]
        
        # Audit log
        EventService._log_audit(user_id, "CREATE_ANNOUNCEMENT", "event_announcements", announcement['id'], None, announcement)
        
        return announcement
