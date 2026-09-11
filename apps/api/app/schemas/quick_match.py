from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

class QuickMatchPlayer(BaseModel):
    user_id: Optional[str] = None
    guest_name: Optional[str] = None
    jersey_number: Optional[int] = None

class QuickMatchTeam(BaseModel):
    name: str
    players: List[QuickMatchPlayer]

class QuickMatchCreate(BaseModel):
    match_name: Optional[str] = "Quick Match"
    venue_id: Optional[str] = None
    venue_field_id: Optional[str] = None
    referee_id: Optional[str] = None
    scorer_id: Optional[str] = None
    team_a: QuickMatchTeam
    team_b: QuickMatchTeam

class QuickMatchResponse(BaseModel):
    match_id: str
    event_id: str
