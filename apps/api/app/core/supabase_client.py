from supabase import AsyncClient, Client, create_async_client, create_client

from app.config import settings

# --- Synchronous Client (used by legacy services) ---
supabase_admin: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY
)

def get_service_supabase() -> Client:
    return supabase_admin

# --- Asynchronous Client (used by high-performance event loop services) ---
# We must use AsyncClient on Windows for FastAPI endpoints, otherwise httpx synchronous client hangs for 45s due to socket/IPv6 issues
_async_supabase_admin: AsyncClient | None = None

async def get_async_service_supabase() -> AsyncClient:
    global _async_supabase_admin
    if _async_supabase_admin is None:
        _async_supabase_admin = await create_async_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )
    return _async_supabase_admin



