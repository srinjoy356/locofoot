from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID

class LeaderboardRow(BaseModel):
    event_player_id: UUID
    player_unique_code: Optional[str] = None
    player_name: str
    player_avatar: Optional[str] = None
    team_name: str
    team_registration_id: UUID
    matches_played: int
    minutes_played: int
    value: float # The primary metric value

class LeaderboardResponse(BaseModel):
    metric: str
    scope: str
    filters: Dict[str, Any]
    threshold: Optional[int]
    data: List[LeaderboardRow]
    next_cursor: Optional[int] = None
    generated_at: str

class TournamentStandingRow(BaseModel):
    team_registration_id: UUID
    team_name: str
    team_logo: Optional[str] = None
    matches_played: int
    wins: int
    draws: int
    losses: int
    goals_for: int
    goals_against: int
    goal_difference: int
    points: int
    fair_play_score: Optional[float] = None

class PlayerStatsResponse(BaseModel):
    event_player_id: UUID
    matches_played: int
    goals: int
    assists: int
    yellow_cards: int
    red_cards: int
    rating: Optional[float] = None

class TeamStatsResponse(BaseModel):
    team_registration_id: UUID
    matches_played: int
    goals_for: int
    goals_against: int
    clean_sheets: int
    yellow_cards: int
    red_cards: int

