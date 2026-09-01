from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime

class RegistrationStatus(str, Enum):
    DRAFT = 'DRAFT'
    PENDING_APPROVAL = 'PENDING_APPROVAL'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'
    WITHDRAWN = 'WITHDRAWN'

class PlayerEligibilityStatus(str, Enum):
    PENDING_APPROVAL = 'PENDING_APPROVAL'
    APPROVED = 'APPROVED'
    SUSPENDED = 'SUSPENDED'
    REMOVED = 'REMOVED'

class InvitationStatus(str, Enum):
    PENDING = 'PENDING'
    ACCEPTED = 'ACCEPTED'
    DECLINED = 'DECLINED'
    CANCELLED = 'CANCELLED'

class TeamRegistrationCreate(BaseModel):
    team_name: str
    team_short_name: Optional[str] = None
    logo_media_id: Optional[str] = None

class TeamRegistrationStatusUpdate(BaseModel):
    status: RegistrationStatus

class EventTeamInvitationCreate(BaseModel):
    invited_user_id: str

class EventTeamInvitationStatusUpdate(BaseModel):
    status: InvitationStatus

class EventRosterPlayerAdd(BaseModel):
    user_id: str
    jersey_number: Optional[int] = None
    position: Optional[str] = None
    is_captain_for_event: Optional[bool] = False
    is_vice_captain_for_event: Optional[bool] = False

class EventRosterPlayerStatusUpdate(BaseModel):
    status: PlayerEligibilityStatus

class EventRosterPlayerUpdate(BaseModel):
    jersey_number: Optional[int] = None
    position: Optional[str] = None
    is_captain_for_event: Optional[bool] = None
    is_vice_captain_for_event: Optional[bool] = None
