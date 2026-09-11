from fastapi import APIRouter, Depends, status
from app.core.security import get_current_user
from app.schemas.quick_match import QuickMatchCreate, QuickMatchResponse
from app.services.quick_match_service import QuickMatchService

router = APIRouter(prefix="/api/v1/quick-match", tags=["quick-match"])

@router.post("", status_code=status.HTTP_201_CREATED, response_model=QuickMatchResponse)
def create_quick_match(
    data: QuickMatchCreate,
    current_user: dict = Depends(get_current_user)
):
    return QuickMatchService.create_quick_match(data, current_user["id"])

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quick_match(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    QuickMatchService.delete_quick_match(event_id, current_user["id"])
