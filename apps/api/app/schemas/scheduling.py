from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from datetime import datetime
from uuid import UUID
from enum import Enum

class SlotTiming(BaseModel):
    sequence: int
    start: datetime
    end: datetime

class AISlotGenerationRequest(BaseModel):
    prompt: str
    timezone: str = "UTC"

class AISlotGenerationResponse(BaseModel):
    timezone: str
    slots: List[SlotTiming]

class SlotFinalizeRequest(BaseModel):
    slots: List[SlotTiming]

class SlotAppendRequest(BaseModel):
    slots: List[SlotTiming]

class ScheduleNextRequest(BaseModel):
    idempotency_key: UUID

class ScheduleOverrideRequest(BaseModel):
    idempotency_key: UUID
    fixture_id: UUID
    new_slot_id: UUID
    new_field_id: UUID

class ScheduleReshuffleRequest(BaseModel):
    idempotency_key: UUID
    new_order: List[UUID] # List of match IDs

class ScheduleStateUpdateResponse(BaseModel):
    success: bool
    state: str

class GenerateFixturesRequest(BaseModel):
    idempotency_key: UUID
    tournament_format: Optional[str] = None  # falls back to the event's saved format
    group_count: int = Field(2, ge=2, le=16)  # GROUP_KNOCKOUT only
    advance_per_group: int = Field(2, ge=1, le=8)  # GROUP_KNOCKOUT only
    third_place: bool = True
    double_round_robin_groups: bool = False  # GROUP_KNOCKOUT: home and away inside each group
    draw: Literal["SEEDED", "RANDOM"] = "SEEDED"  # SEEDED: strongest first (set seeds on the registrations page); RANDOM: shuffled

class KnockoutWinnerRequest(BaseModel):
    winner_registration_id: UUID
    shootout_home: Optional[int] = Field(None, ge=0, le=99)  # penalty shoot-out score, if one was played
    shootout_away: Optional[int] = Field(None, ge=0, le=99)

class GenerateFixturesResponse(BaseModel):
    success: bool
    fixture_count: int
    message: str

class BroadcastStateRequest(BaseModel):
    state: str

class ScheduleUnassignRequest(BaseModel):
    fixture_id: UUID

class ManualMatchCreateRequest(BaseModel):
    idempotency_key: UUID
    home_registration_id: Optional[UUID] = None
    away_registration_id: Optional[UUID] = None
    group_id: Optional[UUID] = None
    bracket_id: Optional[UUID] = None
    slot_assignment_id: UUID
    metadata: Optional[dict] = None
