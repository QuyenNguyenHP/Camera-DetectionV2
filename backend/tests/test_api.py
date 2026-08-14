import asyncio
from tempfile import SpooledTemporaryFile

import pytest
from fastapi import HTTPException, UploadFile

from vision_app.image_utils import decode_upload
from vision_app.main import health, parse_classes


def test_health_does_not_force_model_download():
    payload = asyncio.run(health())
    assert payload["status"] == "ok"
    assert payload["modelLoaded"] is False
    assert payload["gestureModelLoaded"] is False


def test_parse_classes_is_bounded_and_sanitized():
    assert parse_classes(" person, red car, !!!, DOG ") == ["person", "red car", "dog"]


def test_invalid_image_is_rejected():
    file = SpooledTemporaryFile()
    file.write(b"not an image")
    file.seek(0)
    upload = UploadFile(filename="bad.jpg", file=file)
    with pytest.raises(HTTPException) as error:
        asyncio.run(decode_upload(upload))
    assert error.value.status_code == 400
