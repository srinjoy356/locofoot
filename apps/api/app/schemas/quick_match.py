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
    players_on_field: Optional[int] = 5
    substitutes_allowed: Optional[int] = 3
    first_half_minutes: Optional[int] = 15
    second_half_minutes: Optional[int] = 15
    team_a: QuickMatchTeam
    team_b: QuickMatchTeam

class QuickMatchResponse(BaseModel):
    match_id: str
    event_id: str
