from uuid import UUID
from datetime import datetime
from fastapi import HTTPException
from app.core.supabase_client import get_service_supabase
from pydantic import BaseModel

class IdempotencyService:
    @staticmethod
    def check_idempotency(key: UUID, event_id: UUID, operation_scope: str) -> dict | None:
        supabase = get_service_supabase()
        res = supabase.table("idempotency_keys").select("*").eq("key", str(key)).execute()
        
        if res.data:
            data = res.data[0]
            if data["event_id"] != str(event_id) or data["operation_scope"] != operation_scope:
                raise HTTPException(status_code=400, detail="Idempotency key mismatch")
            return data["response_snapshot"]
        
        return None

    @staticmethod
    def save_idempotency(key: UUID, actor_id: UUID, event_id: UUID, operation_scope: str, response_snapshot: dict):
        supabase = get_service_supabase()
        supabase.table("idempotency_keys").insert({
            "key": str(key),
            "actor_id": str(actor_id),
            "event_id": str(event_id),
            "operation_scope": operation_scope,
            "response_snapshot": response_snapshot
        }).execute()
