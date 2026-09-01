from fastapi import Header, HTTPException, Depends
from supabase import AsyncClient
from app.core.supabase_client import get_async_service_supabase

async def get_current_user(
    authorization: str = Header(...),
    db: AsyncClient = Depends(get_async_service_supabase)
) -> dict:
    try:
        token = authorization.removeprefix("Bearer ").strip()
    except AttributeError:
        token = authorization

    if not token or token == "undefined" or token == "null":
        raise HTTPException(401, "Invalid token format")

    try:
        # Use async supabase client to verify token. This is safe from socket starvation.
        res = await db.auth.get_user(token)
        if not res or not res.user:
            raise HTTPException(401, "Invalid token")
            
        return {"id": res.user.id, "role": res.user.role}
    except Exception as e:
        print(f"Auth Exception: {e!s}")
        raise HTTPException(401, "Invalid token")
