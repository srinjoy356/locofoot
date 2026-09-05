from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime

class EventStatus(str, Enum):
    DRAFT = 'DRAFT'
    REGISTRATION_OPEN = 'REGISTRATION_OPEN'
    REGISTRATION_CLOSED = 'REGISTRATION_CLOSED'
    SCHEDULING = 'SCHEDULING'
    SCHEDULED = 'SCHEDULED'
    LIVE = 'LIVE'
    COMPLETED = 'COMPLETED'
    CANCELLED = 'CANCELLED'
    ARCHIVED = 'ARCHIVED'

class EventRole(str, Enum):
    EVENT_OWNER = 'EVENT_OWNER'
    EVENT_ADMIN = 'EVENT_ADMIN'
    EVENT_MANAGER = 'EVENT_MANAGER'
    REFEREE = 'REFEREE'
    SCORER = 'SCORER'
    VOLUNTEER = 'VOLUNTEER'
    VIEWER = 'VIEWER'

class TournamentFormat(str, Enum):
    ROUND_ROBIN = 'ROUND_ROBIN'
    DOUBLE_ROUND_ROBIN = 'DOUBLE_ROUND_ROBIN'
    KNOCKOUT = 'KNOCKOUT'
    GROUP_KNOCKOUT = 'GROUP_KNOCKOUT'
    SWISS = 'SWISS'
    CUSTOM = 'CUSTOM'

class EventCreate(BaseModel):
    name: str
    description: str

class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    event_code: Optional[str] = None
    slug: Optional[str] = None
    logo_media_id: Optional[str] = None
    banner_media_id: Optional[str] = None
    rules: Optional[str] = None
    venue_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    registration_deadline: Optional[datetime] = None

class EventStatusUpdate(BaseModel):
    status: EventStatus

class EventSettingsUpdate(BaseModel):
    players_on_field: Optional[int] = Field(None, ge=1)
    substitutes_allowed: Optional[int] = Field(None, ge=0)
    min_squad: Optional[int] = Field(None, ge=1)
    max_squad: Optional[int] = Field(None, ge=1)
    first_half_minutes: Optional[int] = Field(None, gt=0)
    second_half_minutes: Optional[int] = Field(None, gt=0)
    half_time_minutes: Optional[int] = Field(None, ge=0)
    extra_time_allowed: Optional[bool] = None
    extra_time_minutes: Optional[int] = Field(None, ge=0)
    penalty_shootout_allowed: Optional[bool] = None
    max_substitutions: Optional[int] = Field(None, ge=0)
    rolling_subs: Optional[bool] = None
    injury_time_tracking: Optional[bool] = None
    buffer_minutes: Optional[int] = Field(None, ge=0)
    min_rest_minutes: Optional[int] = Field(None, ge=0)
    points_win: Optional[int] = None
    points_draw: Optional[int] = None
    points_loss: Optional[int] = None
    fair_play_affects_ranking: Optional[bool] = None
    fair_play_as_tiebreak: Optional[bool] = None
    tie_break_order: Optional[list[str]] = None
    tournament_format: Optional[TournamentFormat] = None
    allow_duplicate_jersey_numbers: Optional[bool] = None

class EventRoleCreate(BaseModel):
    user_id: str
    role: EventRole
