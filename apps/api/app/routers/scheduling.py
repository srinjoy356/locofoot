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
    ScheduleUnassignRequest,
    SlotAppendRequest,
    BroadcastStateRequest,
    ManualMatchCreateRequest,
    KnockoutWinnerRequest,
)
from app.services.slot_service import slot_service
from app.services.scheduling_service import scheduling_service
from app.services.tournament_service import tournament_service
from app.core.security import get_current_user
from app.services.event_service import EventService


async def require_event_admin(event_id: UUID, current_user = Depends(get_current_user)) -> dict:
    EventService._require_admin(str(event_id), str(current_user["id"]))
    return current_user

router = APIRouter(prefix="/api/v1/events/{event_id}", tags=["scheduling"])

@router.post("/slots/generate-ai", response_model=AISlotGenerationResponse)
async def generate_slots_ai(event_id: UUID, payload: AISlotGenerationRequest, current_user = Depends(require_event_admin)):
    return await slot_service.generate_slots_ai(event_id, payload)

@router.post("/slots/finalize")
async def finalize_slots(event_id: UUID, payload: SlotFinalizeRequest, current_user = Depends(require_event_admin)):
    return await slot_service.finalize_slots(event_id, payload)

@router.post("/slots/append")
async def append_slots(event_id: UUID, payload: SlotAppendRequest, current_user = Depends(require_event_admin)):
    return await slot_service.append_slots(event_id, payload)

@router.post("/schedule/next")
async def generate_next_slot(event_id: UUID, payload: ScheduleNextRequest, current_user = Depends(require_event_admin)):
    return await scheduling_service.generate_next_slot(event_id, payload, UUID(current_user["id"]))

@router.post("/schedule/override")
async def override_schedule(event_id: UUID, payload: ScheduleOverrideRequest, current_user = Depends(require_event_admin)):
    return await scheduling_service.override_schedule(event_id, payload)

@router.post("/fixtures/generate", response_model=GenerateFixturesResponse)
async def generate_fixtures(event_id: UUID, payload: GenerateFixturesRequest, current_user = Depends(get_current_user)):
    return tournament_service.generate(event_id, payload, UUID(current_user["id"]))

@router.post("/fixtures/reset")
async def reset_fixtures(event_id: UUID, current_user = Depends(get_current_user)):
    return tournament_service.reset(event_id, UUID(current_user["id"]))

@router.post("/matches/{match_id}/winner")
async def set_knockout_winner(event_id: UUID, match_id: UUID, payload: KnockoutWinnerRequest, current_user = Depends(get_current_user)):
    return tournament_service.set_winner(event_id, match_id, payload.winner_registration_id, UUID(current_user["id"]),
                                         payload.shootout_home, payload.shootout_away)

@router.get("/standings/groups")
async def group_standings(event_id: UUID):
    return tournament_service.group_standings(event_id)

@router.get("/bracket")
async def bracket(event_id: UUID):
    return tournament_service.bracket(event_id)

@router.post("/broadcast-state")
async def update_broadcast_state(event_id: UUID, payload: BroadcastStateRequest, current_user = Depends(get_current_user)):
    return await scheduling_service.update_broadcast_state(event_id, payload.state, UUID(current_user["id"]))

@router.post("/schedule/unassign")
async def unassign_fixture(event_id: UUID, payload: ScheduleUnassignRequest, current_user = Depends(require_event_admin)):
    return await scheduling_service.unassign_fixture(event_id, payload)

@router.post("/fixtures/manual")
async def create_manual_match(event_id: UUID, payload: ManualMatchCreateRequest, current_user = Depends(require_event_admin)):
    return await scheduling_service.create_manual_match(event_id, payload, UUID(current_user["id"]))


