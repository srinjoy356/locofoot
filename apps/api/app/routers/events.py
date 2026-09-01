from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from app.core.security import get_current_user
from app.schemas.events import EventCreate, EventUpdate, EventSettingsUpdate, EventStatusUpdate, EventRoleCreate
from app.services.event_service import EventService

router = APIRouter(prefix="/api/v1/events", tags=["events"])

@router.post("", status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: EventCreate,
    current_user: dict = Depends(get_current_user)
):
    return EventService.create_event(event_data, current_user["id"])

@router.patch("/{event_id}")
def update_event(
    event_id: str,
    event_data: EventUpdate,
    current_user: dict = Depends(get_current_user)
):
    return EventService.update_event(event_id, event_data, current_user["id"])

@router.put("/{event_id}/settings")
def update_event_settings(
    event_id: str,
    settings_data: EventSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    return EventService.update_settings(event_id, settings_data, current_user["id"])

@router.put("/{event_id}/status")
def update_event_status(
    event_id: str,
    status_data: EventStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    return EventService.update_status(event_id, status_data, current_user["id"])

@router.post("/{event_id}/roles", status_code=status.HTTP_201_CREATED)
def assign_role(
    event_id: str,
    role_data: EventRoleCreate,
    current_user: dict = Depends(get_current_user)
):
    return EventService.assign_role(event_id, role_data, current_user["id"])

@router.delete("/{event_id}/roles/{role_id}")
def revoke_role(
    event_id: str,
    role_id: str,
    current_user: dict = Depends(get_current_user)
):
    return EventService.revoke_role(event_id, role_id, current_user["id"])

# ----------------- REGISTRATION ROUTES -----------------
from app.schemas.registrations import (
    TeamRegistrationCreate, 
    TeamRegistrationStatusUpdate, 
    EventTeamInvitationCreate, 
    EventTeamInvitationStatusUpdate
)
from app.services.registration_service import RegistrationService

@router.get("/{event_id}/registrations")
def get_registrations(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    return RegistrationService.get_registrations(event_id, current_user["id"])

@router.post("/{event_id}/registrations", status_code=status.HTTP_201_CREATED)
def create_registration(
    event_id: str,
    data: TeamRegistrationCreate,
    current_user: dict = Depends(get_current_user)
):
    return RegistrationService.create_registration(event_id, data, current_user["id"])

@router.post("/{event_id}/registrations/{reg_id}/invitations", status_code=status.HTTP_201_CREATED)
def invite_player(
    event_id: str,
    reg_id: str,
    data: EventTeamInvitationCreate,
    current_user: dict = Depends(get_current_user)
):
    return RegistrationService.invite_player(event_id, reg_id, data, current_user["id"])

@router.patch("/{event_id}/registrations/{reg_id}/invitations/{inv_id}/status")
def update_invitation_status(
    event_id: str,
    reg_id: str,
    inv_id: str,
    data: EventTeamInvitationStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    return RegistrationService.update_invitation_status(event_id, reg_id, inv_id, data, current_user["id"])

@router.delete("/{event_id}/registrations/{reg_id}/players/{player_user_id}")
def remove_player(
    event_id: str,
    reg_id: str,
    player_user_id: str,
    current_user: dict = Depends(get_current_user)
):
    return RegistrationService.remove_player(event_id, reg_id, player_user_id, current_user["id"])

@router.post("/{event_id}/registrations/{reg_id}/submit")
def submit_registration(
    event_id: str,
    reg_id: str,
    current_user: dict = Depends(get_current_user)
):
    return RegistrationService.submit_registration(event_id, reg_id, current_user["id"])

@router.put("/{event_id}/registrations/{reg_id}/status")
def update_registration_status(
    event_id: str,
    reg_id: str,
    data: TeamRegistrationStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    return RegistrationService.update_registration_status(event_id, reg_id, data, current_user["id"])

@router.post("/{event_id}/registrations/{reg_id}/lock")
def lock_roster(
    event_id: str,
    reg_id: str,
    current_user: dict = Depends(get_current_user)
):
    return RegistrationService.lock_roster(event_id, reg_id, current_user["id"])

@router.post("/{event_id}/registrations/{reg_id}/unlock")
def unlock_roster(
    event_id: str,
    reg_id: str,
    current_user: dict = Depends(get_current_user)
):
    return RegistrationService.unlock_roster(event_id, reg_id, current_user["id"])

@router.get("/{event_id}/registrations/{reg_id}/squad")
def get_squad(
    event_id: str,
    reg_id: str,
    current_user: dict = Depends(get_current_user)
):
    return RegistrationService.get_squad(event_id, reg_id, current_user["id"])

@router.get("/{event_id}/registrations/{reg_id}/invitations")
def get_invitations(
    event_id: str,
    reg_id: str,
    current_user: dict = Depends(get_current_user)
):
    return RegistrationService.get_invitations(event_id, reg_id, current_user["id"])
