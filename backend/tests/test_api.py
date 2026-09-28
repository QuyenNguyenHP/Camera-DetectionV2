import asyncio
from tempfile import SpooledTemporaryFile

import pytest
from fastapi import HTTPException, UploadFile

from vision_app.image_utils import decode_upload
from vision_app.main import health


def test_health_does_not_force_model_download():
    payload = asyncio.run(health())
    assert payload["status"] == "ok"
    assert payload["poseModelLoaded"] is False
    assert payload["fallDetection"] == "temporal-pose"
    assert payload["device"] == "cpu"


def test_invalid_image_is_rejected():
    file = SpooledTemporaryFile()
    file.write(b"not an image")
    file.seek(0)
    upload = UploadFile(filename="bad.jpg", file=file)
    with pytest.raises(HTTPException) as error:
        asyncio.run(decode_upload(upload))
    assert error.value.status_code == 400
