import time

import cloudinary
import cloudinary.utils

from app.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)

def build_signed_upload_params(folder: str, tags: list[str]) -> dict:
    timestamp = int(time.time())
    params_to_sign = {
        "timestamp": timestamp,
        "folder": folder,
        "tags": ",".join(tags) if tags else ""
    }
    # Cloudinary sdk calculates the signature
    signature = cloudinary.utils.api_sign_request(params_to_sign, settings.CLOUDINARY_API_SECRET)
    return {
        **params_to_sign,
        "signature": signature,
        "api_key": settings.CLOUDINARY_API_KEY,
        "cloud_name": settings.CLOUDINARY_CLOUD_NAME
    }

def destroy_asset(public_id: str, resource_type: str = "image"):
    cloudinary.uploader.destroy(public_id, resource_type=resource_type)
