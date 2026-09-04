from pydantic import BaseModel, Field

class AnnouncementCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    is_emergency: bool = False
