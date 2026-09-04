from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.schemas.announcements import AnnouncementCreate
from app.services.announcement_service import AnnouncementService

router = APIRouter(prefix="/api/v1/events", tags=["announcements"])

@router.post("/{event_id}/announcements")
async def create_announcement(event_id: str, data: AnnouncementCreate, current_user: dict = Depends(get_current_user)):
    return AnnouncementService.create_announcement(event_id, data, current_user['id'])
