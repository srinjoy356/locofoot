from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from uuid import UUID
from supabase import AsyncClient
from fastapi import APIRouter, Depends

from ..core.supabase_client import get_async_service_supabase
from ..core.security import get_current_user
from ..schemas.match_operations import (
    StateTransitionRequest,
    RefereeEventRequest,
    TimelineEventRequest,
    CorrectionRequest
)
from ..services.match_engine_service import MatchEngineService

router = APIRouter(
    prefix="/api/v1/events/{event_id}/matches/{match_id}",
    tags=["match_engine"]
)

# 1. State changes
@router.post("/referee/state", response_model=Dict[str, Any])
async def change_match_state(
    event_id: UUID,
    match_id: UUID,
    req: StateTransitionRequest,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.transition_state(match_id, UUID(user['id']), req)

# 2. Referee Events
@router.post("/referee/event", response_model=Dict[str, Any])
async def record_referee_event(
    event_id: UUID,
    match_id: UUID,
    req: RefereeEventRequest,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.record_referee_event(match_id, UUID(user['id']), req)

# 3. Timeline Events
@router.post("/timeline/event", response_model=Dict[str, Any])
async def record_timeline_event(
    event_id: UUID,
    match_id: UUID,
    req: TimelineEventRequest,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.record_timeline_event(match_id, UUID(user['id']), req)

# 4. Corrections
@router.patch("/timeline/event", response_model=Dict[str, Any])
async def correct_timeline_event(
    event_id: UUID,
    match_id: UUID,
    req: CorrectionRequest,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.correct_timeline_event(match_id, UUID(user['id']), req)

@router.patch("/referee/event", response_model=Dict[str, Any])
async def correct_referee_event(
    event_id: UUID,
    match_id: UUID,
    req: CorrectionRequest,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.correct_referee_event(match_id, UUID(user['id']), req)

# 5. Lineups
from ..schemas.match_operations import LineupSubmissionRequest

@router.post("/lineups/submit", response_model=Dict[str, Any])
async def submit_lineup(
    event_id: UUID,
    match_id: UUID,
    req: LineupSubmissionRequest,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.submit_lineup(match_id, req.team_registration_id, UUID(user['id']), req.players)

@router.post("/lineups/confirm", response_model=Dict[str, Any])
async def confirm_lineup(
    event_id: UUID,
    match_id: UUID,
    team_registration_id: UUID,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.confirm_lineup(match_id, team_registration_id, UUID(user['id']))
