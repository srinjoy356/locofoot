from fastapi import APIRouter, Depends
from uuid import UUID
from app.schemas.scheduling import (
    AISlotGenerationRequest, 
    AISlotGenerationResponse, 
    SlotFinalizeRequest,
    ScheduleNextRequest,
    ScheduleOverrideRequest,
    GenerateFixturesRequest,
    GenerateFixturesResponse,
    ScheduleUnassignRequest
)
from app.services.slot_service import slot_service
from app.services.scheduling_service import scheduling_service
from app.core.security import get_current_user

router = APIRouter(prefix="/api/v1/events/{event_id}", tags=["scheduling"])

@router.post("/slots/generate-ai", response_model=AISlotGenerationResponse)
async def generate_slots_ai(event_id: UUID, payload: AISlotGenerationRequest, current_user = Depends(get_current_user)):
    return await slot_service.generate_slots_ai(event_id, payload)

@router.post("/slots/finalize")
async def finalize_slots(event_id: UUID, payload: SlotFinalizeRequest, current_user = Depends(get_current_user)):
    return await slot_service.finalize_slots(event_id, payload)

@router.post("/schedule/next")
async def generate_next_slot(event_id: UUID, payload: ScheduleNextRequest, current_user = Depends(get_current_user)):
    return await scheduling_service.generate_next_slot(event_id, payload, UUID(current_user["id"]))

@router.post("/schedule/override")
async def override_schedule(event_id: UUID, payload: ScheduleOverrideRequest, current_user = Depends(get_current_user)):
    return await scheduling_service.override_schedule(event_id, payload)

@router.post("/fixtures/generate", response_model=GenerateFixturesResponse)
async def generate_fixtures(event_id: UUID, payload: GenerateFixturesRequest, current_user = Depends(get_current_user)):
    return await scheduling_service.generate_fixtures(event_id, payload, UUID(current_user["id"]))

from app.schemas.scheduling import BroadcastStateRequest

@router.post("/broadcast-state")
async def update_broadcast_state(event_id: UUID, payload: BroadcastStateRequest, current_user = Depends(get_current_user)):
    return await scheduling_service.update_broadcast_state(event_id, payload.state, UUID(current_user["id"]))

@router.post("/schedule/unassign")
async def unassign_fixture(event_id: UUID, payload: ScheduleUnassignRequest, current_user = Depends(get_current_user)):
    return await scheduling_service.unassign_fixture(event_id, payload)

