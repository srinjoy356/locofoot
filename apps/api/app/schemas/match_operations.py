from pydantic import BaseModel, Field, root_validator
from typing import Optional, Dict, Any, List
from uuid import UUID
from enum import Enum
from datetime import datetime

class MatchState(str, Enum):
    SCHEDULED = 'SCHEDULED'
    PRE_MATCH = 'PRE_MATCH'
    READY = 'READY'
    LIVE = 'LIVE'
    HALF_TIME = 'HALF_TIME'
    SECOND_HALF = 'SECOND_HALF'
    EXTRA_TIME_1 = 'EXTRA_TIME_1'
    EXTRA_TIME_BREAK = 'EXTRA_TIME_BREAK'
    EXTRA_TIME_2 = 'EXTRA_TIME_2'
    PENALTY_SHOOTOUT = 'PENALTY_SHOOTOUT'
    FULL_TIME = 'FULL_TIME'
    COMPLETED = 'COMPLETED'
    PAUSED = 'PAUSED'
    ABANDONED = 'ABANDONED'
    POSTPONED = 'POSTPONED'
    CANCELLED = 'CANCELLED'

class MatchPeriod(str, Enum):
    PRE_MATCH = 'PRE_MATCH'
    FIRST_HALF = 'FIRST_HALF'
    HALF_TIME = 'HALF_TIME'
    SECOND_HALF = 'SECOND_HALF'
    EXTRA_TIME_1 = 'EXTRA_TIME_1'
    EXTRA_TIME_BREAK = 'EXTRA_TIME_BREAK'
    EXTRA_TIME_2 = 'EXTRA_TIME_2'
    PENALTY_SHOOTOUT = 'PENALTY_SHOOTOUT'
    POST_MATCH = 'POST_MATCH'

class RefereeEventType(str, Enum):
    PERIOD_START = 'PERIOD_START'
    PERIOD_END = 'PERIOD_END'
    STOPPAGE_START = 'STOPPAGE_START'
    STOPPAGE_END = 'STOPPAGE_END'
    SUBSTITUTION = 'SUBSTITUTION'
    FOUL = 'FOUL'
    WARNING = 'WARNING'
    YELLOW_CARD = 'YELLOW_CARD'
    RED_CARD = 'RED_CARD'
    OFFSIDE = 'OFFSIDE'
    OFFICIAL_DECISION = 'OFFICIAL_DECISION'

class TimelineEventType(str, Enum):
    PASS = 'PASS'
    CROSS = 'CROSS'
    SHOT = 'SHOT'
    DRIBBLE = 'DRIBBLE'
    TACKLE = 'TACKLE'
    INTERCEPTION = 'INTERCEPTION'
    BALL_RECOVERY = 'BALL_RECOVERY'
    CLEARANCE = 'CLEARANCE'
    BLOCK = 'BLOCK'
    AERIAL_DUEL = 'AERIAL_DUEL'
    SAVE = 'SAVE'
    AERIAL_CLAIM = 'AERIAL_CLAIM'
    SWEEPER_ACTION = 'SWEEPER_ACTION'
    DISTRIBUTION = 'DISTRIBUTION'
    CORNER = 'CORNER'
    FREE_KICK = 'FREE_KICK'
    DROP_BALL = 'DROP_BALL'
    OFF_BALL_RUN = 'OFF_BALL_RUN'
    ERROR = 'ERROR'
    INJURY_NOTE = 'INJURY_NOTE'
    OTHER = 'OTHER'

class StateTransitionRequest(BaseModel):
    idempotency_key: UUID
    new_state: MatchState
    reason: Optional[str] = None
    announced_added_minutes: Optional[int] = None

class RefereeEventRequest(BaseModel):
    id: UUID  # Client generated UUID for idempotency
    event_type: RefereeEventType
    period: MatchPeriod
    elapsed_seconds: int
    display_minute: int
    display_second: int
    event_player_id: Optional[UUID] = None
    event_registration_id: Optional[UUID] = None
    target_player_id: Optional[UUID] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class TimelineEventRequest(BaseModel):
    id: UUID  # Client generated UUID for idempotency
    event_type: TimelineEventType
    period: MatchPeriod
    elapsed_seconds: int
    display_minute: int
    display_second: int
    actor_player_id: Optional[UUID] = None
    actor_registration_id: Optional[UUID] = None
    target_player_id: Optional[UUID] = None
    target_registration_id: Optional[UUID] = None
    x: Optional[float] = Field(None, ge=0, le=100)
    y: Optional[float] = Field(None, ge=0, le=100)
    referee_event_id: Optional[UUID] = None
    is_big_chance: Optional[bool] = False
    related_event_id: Optional[UUID] = None
    assist_player_id: Optional[UUID] = None
    assist_event_id: Optional[UUID] = None
    second_assist_player_id: Optional[UUID] = None
    second_assist_event_id: Optional[UUID] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CorrectionRequest(BaseModel):
    idempotency_key: UUID
    timeline_event_id: UUID
    corrected_payload: Dict[str, Any]
    reason: str
  
class LineupRole(str, Enum):  
    STARTER = 'STARTER'  
    SUBSTITUTE = 'SUBSTITUTE'  
  
class LineupStatus(str, Enum):  
    DRAFT = 'DRAFT'  
    SUBMITTED = 'SUBMITTED'  
    MODIFIED = 'MODIFIED'  
    RESUBMITTED = 'RESUBMITTED'  
    CHANGES_REQUESTED = 'CHANGES_REQUESTED'  
    CONFIRMED = 'CONFIRMED'  
  
class LineupPlayerInput(BaseModel):  
    event_team_player_id: UUID  
    lineup_role: LineupRole  
  
class LineupSubmissionRequest(BaseModel):  
    team_registration_id: UUID  
    players: List[LineupPlayerInput] 
