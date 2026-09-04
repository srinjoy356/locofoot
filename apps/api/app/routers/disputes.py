from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.schemas.disputes import DisputeCreate, DisputeUpdate
from app.services.dispute_service import DisputeService

router = APIRouter(prefix="/api/v1/events", tags=["disputes"])

@router.post("/{event_id}/disputes")
async def create_dispute(event_id: str, data: DisputeCreate, current_user: dict = Depends(get_current_user)):
    return DisputeService.create_dispute(event_id, data, current_user['id'])

@router.patch("/{event_id}/disputes/{dispute_id}")
async def update_dispute(event_id: str, dispute_id: str, data: DisputeUpdate, current_user: dict = Depends(get_current_user)):
    return DisputeService.update_dispute(event_id, dispute_id, data, current_user['id'])
