import cv2
import numpy as np
from fastapi import HTTPException, UploadFile

from .config import settings


async def decode_upload(upload: UploadFile) -> tuple[np.ndarray, bytes]:
    content = await upload.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        limit_mb = settings.max_upload_bytes / (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"Image is larger than {limit_mb:g} MB")
    if not content:
        raise HTTPException(status_code=400, detail="Image is empty")

    image = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Unsupported or invalid image")
    return image, content
