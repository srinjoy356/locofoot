
from pydantic import BaseModel


class SignatureRequest(BaseModel):
    ownerType: str
    ownerId: str

class SignatureResponse(BaseModel):
    timestamp: int
    folder: str
    tags: str
    signature: str
    api_key: str
    cloud_name: str
