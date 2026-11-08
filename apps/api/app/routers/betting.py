from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.core.supabase_client import get_async_service_supabase
from app.services.betting_service import betting_service
from app.services.event_service import EventService

router = APIRouter(prefix="/api/v1/predictions", tags=["predictions"])


async def optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Odds are public; only placing a bet needs an account. A bad token just means 'not signed in'."""
    if not authorization:
        return None
    try:
        return await get_current_user(authorization, await get_async_service_supabase())
    except Exception:
        return None


class PlaceBet(BaseModel):
    market_id: UUID
    selection: str = Field(min_length=2, max_length=12)
    stake: int = Field(ge=1, le=500)
    odds: float = Field(gt=1)  # the price the user saw; the server re-prices and rejects if it got worse
    idempotency_key: Optional[UUID] = None


class Pause(BaseModel):
    paused: bool


@router.get("/wallet")
async def wallet(user: dict = Depends(get_current_user)):
    return betting_service.wallet(user["id"])


@router.post("/wallet/refill")
async def refill(user: dict = Depends(get_current_user)):
    return betting_service.refill(user["id"])


@router.get("/live")
async def live():
    return betting_service.live_hub()


@router.get("/matches/{match_id}")
async def board(match_id: UUID, user: Optional[dict] = Depends(optional_user)):
    return betting_service.board(str(match_id), user["id"] if user else None)


@router.post("/matches/{match_id}/bets")
async def place_bet(match_id: UUID, body: PlaceBet, user: dict = Depends(get_current_user)):
    return betting_service.place(user["id"], str(match_id), str(body.market_id), body.selection, body.stake, body.odds, body.idempotency_key)


@router.post("/matches/{match_id}/pause")
async def pause_betting(match_id: UUID, body: Pause, user: dict = Depends(get_current_user)):
    """Officials can freeze betting at once (for example while a goal is being checked)."""
    from app.core.supabase_client import get_service_supabase
    sb = get_service_supabase()
    m = sb.table("matches").select("event_id").eq("id", str(match_id)).execute().data
    if not m:
        return {"paused": False}
    roles = sb.table("event_roles").select("id").eq("event_id", m[0]["event_id"]).eq("user_id", user["id"]) \
        .in_("role", ["EVENT_OWNER", "EVENT_ADMIN", "EVENT_MANAGER", "REFEREE", "SCORER"]).limit(1).execute().data
    if not roles:
        from fastapi import HTTPException
        raise HTTPException(403, "Only event staff can pause betting")
    return betting_service.set_paused(str(match_id), body.paused)


@router.get("/bets/me")
async def my_bets(limit: int = Query(50, ge=1, le=200), user: dict = Depends(get_current_user)):
    return betting_service.my_bets(user["id"], limit)


@router.get("/leaderboard")
async def leaderboard(event_id: Optional[UUID] = None, limit: int = Query(50, ge=1, le=200)):
    return betting_service.leaderboard(str(event_id) if event_id else None, limit)
