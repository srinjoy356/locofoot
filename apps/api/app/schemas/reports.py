from pydantic import BaseModel, Field
from typing import Optional, Literal
from uuid import UUID

class ReportCreate(BaseModel):
    target_type: Literal['USER', 'TEAM', 'EVENT', 'MESSAGE', 'OTHER']
    target_id: UUID
    reason: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None

class ReportUpdate(BaseModel):
    status: Literal['OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED']
    resolution_notes: Optional[str] = None
