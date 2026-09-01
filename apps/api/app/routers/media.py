from fastapi import APIRouter, Depends

from app.core.cloudinary_client import build_signed_upload_params
from app.core.security import get_current_user
from app.schemas.media import SignatureRequest, SignatureResponse

router = APIRouter(prefix="/media", tags=["media"])

@router.post("/signature", response_model=SignatureResponse)
async def generate_signature(
    request: SignatureRequest,
    current_user: dict = Depends(get_current_user)
):
    # Depending on ownerType, we might choose different folders or tags
    folder = "locofoot/avatars" if request.ownerType == "USER_AVATAR" else "locofoot/misc"
    tags = [request.ownerType, request.ownerId]
    
    sig = build_signed_upload_params(folder, tags)
    return SignatureResponse(**sig)
