from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from supabase import AsyncClient

from ..core.supabase_client import get_async_service_supabase
from ..core.security import get_current_user
from ..schemas.match_operations import (
    StateTransitionRequest,
    RefereeEventRequest,
    TimelineEventRequest,
    CorrectionRequest,
    MatchForfeitRequest
)
from ..services.match_engine_service import MatchEngineService

router = APIRouter(
    prefix="/api/v1/events/{event_id}/matches/{match_id}",
    tags=["match_engine"]
)

OFFICIAL_ROLES = ["EVENT_OWNER", "EVENT_ADMIN", "EVENT_MANAGER", "REFEREE", "SCORER"]
# the recorder (SCORER) logs play but may not run the match: no kick-off, cards, forfeits or result changes
REFEREE_ROLES = [r for r in OFFICIAL_ROLES if r != "SCORER"]


def _match_guard(allowed_roles: list[str]):
    async def guard(
        event_id: UUID,
        match_id: UUID,
        user: dict = Depends(get_current_user),
        db: AsyncClient = Depends(get_async_service_supabase),
    ) -> dict:
        """Only event staff in an allowed role or the referee assigned to this match may drive it."""
        m = await db.table("matches").select("event_id").eq("id", str(match_id)).execute()
        if not m.data or m.data[0]["event_id"] != str(event_id):
            raise HTTPException(status_code=404, detail="Match not found in this event")
        roles = await db.table("event_roles").select("id").eq("event_id", str(event_id))             .eq("user_id", user["id"]).in_("role", allowed_roles).limit(1).execute()
        if roles.data:
            return user
        assigned = await db.table("match_referees").select("id").eq("match_id", str(match_id))             .eq("user_id", user["id"]).limit(1).execute()
        if not assigned.data:
            raise HTTPException(status_code=403, detail="Not authorized to officiate this match")
        return user
    return guard


require_match_official = _match_guard(OFFICIAL_ROLES)
require_match_referee = _match_guard(REFEREE_ROLES)


async def require_lineup_manager(db: AsyncClient, event_id: UUID, match_id: UUID, team_registration_id: UUID, user: dict):
    """Staff, or the registering captain / event captain / vice-captain of a team that plays this match."""
    m = await db.table("matches").select("event_id, home_registration_id, away_registration_id").eq("id", str(match_id)).execute()
    if not m.data or m.data[0]["event_id"] != str(event_id):
        raise HTTPException(status_code=404, detail="Match not found in this event")
    if str(team_registration_id) not in (m.data[0]["home_registration_id"], m.data[0]["away_registration_id"]):
        raise HTTPException(status_code=400, detail="Team is not playing in this match")
    # staff and match officials (the referee confirms the lineups they are about to kick off with)
    staff = await db.table("event_roles").select("id").eq("event_id", str(event_id)).eq("user_id", user["id"])         .in_("role", OFFICIAL_ROLES).limit(1).execute()
    if staff.data:
        return
    assigned = await db.table("match_referees").select("id").eq("match_id", str(match_id)).eq("user_id", user["id"]).limit(1).execute()
    if assigned.data:
        return
    reg = await db.table("event_team_registrations").select("captain_id").eq("id", str(team_registration_id)).execute()
    if reg.data and reg.data[0].get("captain_id") == user["id"]:
        return
    lead = await db.table("event_team_players").select("id").eq("event_registration_id", str(team_registration_id))         .eq("user_id", user["id"]).or_("is_captain_for_event.eq.true,is_vice_captain_for_event.eq.true").limit(1).execute()
    if lead.data:
        return
    raise HTTPException(status_code=403, detail="Not authorized to manage this team's lineup")


# 1. State changes
@router.post("/referee/state", response_model=Dict[str, Any])
async def change_match_state(
    event_id: UUID,
    match_id: UUID,
    req: StateTransitionRequest,
    user: dict = Depends(require_match_referee),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.transition_state(match_id, UUID(user['id']), req)

@router.post("/referee/forfeit", response_model=Dict[str, Any])
async def forfeit_match(
    event_id: UUID,
    match_id: UUID,
    req: MatchForfeitRequest,
    user: dict = Depends(require_match_referee),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.forfeit_match(match_id, UUID(user['id']), req)

# 2. Referee Events
@router.post("/referee/event", response_model=Dict[str, Any])
async def record_referee_event(
    event_id: UUID,
    match_id: UUID,
    req: RefereeEventRequest,
    user: dict = Depends(require_match_referee),
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
    user: dict = Depends(require_match_official),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.record_timeline_event(match_id, UUID(user['id']), req)

class TimelineBatch(BaseModel):
    events: list[TimelineEventRequest] = Field(min_length=1, max_length=100)


@router.post("/timeline/events", response_model=Dict[str, Any])
async def record_timeline_events(
    event_id: UUID,
    match_id: UUID,
    req: TimelineBatch,
    user: dict = Depends(require_match_official),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.record_timeline_events(match_id, UUID(user['id']), req.events)

# 4. Corrections
@router.patch("/timeline/event", response_model=Dict[str, Any])
async def correct_timeline_event(
    event_id: UUID,
    match_id: UUID,
    req: CorrectionRequest,
    user: dict = Depends(require_match_official),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.correct_timeline_event(match_id, UUID(user['id']), req)

@router.delete("/timeline/event/{timeline_event_id}", response_model=Dict[str, Any])
async def undo_timeline_event(
    event_id: UUID,
    match_id: UUID,
    timeline_event_id: UUID,
    user: dict = Depends(require_match_official),
    db: AsyncClient = Depends(get_async_service_supabase)
):
    service = MatchEngineService(db)
    return await service.undo_timeline_event(match_id, UUID(user['id']), timeline_event_id)

@router.patch("/referee/event", response_model=Dict[str, Any])
async def correct_referee_event(
    event_id: UUID,
    match_id: UUID,
    req: CorrectionRequest,
    user: dict = Depends(require_match_referee),
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
    await require_lineup_manager(db, event_id, match_id, req.team_registration_id, user)
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
    await require_lineup_manager(db, event_id, match_id, team_registration_id, user)
    service = MatchEngineService(db)
    return await service.confirm_lineup(match_id, team_registration_id, UUID(user['id']))
