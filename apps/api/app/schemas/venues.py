from pydantic import BaseModel, ConfigDict
from typing import Optional

class VenueCreate(BaseModel):
    name: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class VenueUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class VenueFieldCreate(BaseModel):
    name: str
    surface_type: Optional[str] = None
    notes: Optional[str] = None

class VenueFieldUpdate(BaseModel):
    name: Optional[str] = None
    surface_type: Optional[str] = None
    notes: Optional[str] = None
