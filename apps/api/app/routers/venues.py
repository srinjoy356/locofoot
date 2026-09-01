from fastapi import APIRouter, Depends, status
from app.core.security import get_current_user
from app.schemas.venues import VenueCreate, VenueUpdate, VenueFieldCreate, VenueFieldUpdate
from app.services.venue_service import VenueService

router = APIRouter(prefix="/api/v1/venues", tags=["venues"])

@router.post("", status_code=status.HTTP_201_CREATED)
def create_venue(data: VenueCreate, current_user: dict = Depends(get_current_user)):
    return VenueService.create_venue(data, current_user["id"])

@router.patch("/{venue_id}")
def update_venue(venue_id: str, data: VenueUpdate, current_user: dict = Depends(get_current_user)):
    return VenueService.update_venue(venue_id, data, current_user["id"])

@router.post("/{venue_id}/fields", status_code=status.HTTP_201_CREATED)
def create_field(venue_id: str, data: VenueFieldCreate, current_user: dict = Depends(get_current_user)):
    return VenueService.create_field(venue_id, data, current_user["id"])

@router.patch("/{venue_id}/fields/{field_id}")
def update_field(venue_id: str, field_id: str, data: VenueFieldUpdate, current_user: dict = Depends(get_current_user)):
    return VenueService.update_field(venue_id, field_id, data, current_user["id"])

@router.delete("/{venue_id}/fields/{field_id}")
def delete_field(venue_id: str, field_id: str, current_user: dict = Depends(get_current_user)):
    return VenueService.delete_field(venue_id, field_id, current_user["id"])
