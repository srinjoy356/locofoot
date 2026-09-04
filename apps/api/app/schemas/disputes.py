from pydantic import BaseModel, Field
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime

class DisputeCreate(BaseModel):
    match_id: Optional[UUID] = None
    target_type: Literal['MATCH', 'MATCH_EVENT', 'RESULT', 'OTHER']
    target_id: Optional[UUID] = None
    reason: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None

class DisputeUpdate(BaseModel):
    status: Literal['OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'MODIFIED']
    resolution_notes: Optional[str] = None
