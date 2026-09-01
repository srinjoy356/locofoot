from fastapi import APIRouter, Depends

from app.core.security import get_current_user

router = APIRouter(tags=["health"])

@router.get("/health")
async def health_check():
    return {"status": "ok"}

@router.get("/health/auth")
async def auth_health_check(current_user: dict = Depends(get_current_user)):
    return {"status": "ok", "user": current_user}
