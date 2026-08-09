from __future__ import annotations

import re
from time import perf_counter
from uuid import uuid4

import cv2

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .detector import detector
from .faces import face_store
from .image_utils import decode_upload


app = FastAPI(title="Vision Guard ML Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def parse_classes(value: str) -> list[str]:
    classes = [part.strip().lower() for part in value.split(",") if part.strip()]
    clean = [item for item in classes if re.fullmatch(r"[a-z0-9][a-z0-9 _-]{0,39}", item)]
    return clean[:20]


def save_enrollment_photo(name: str, frame) -> None:
    """Store a normalized enrollment photo in a safe per-person directory."""
    directory_name = re.sub(r"[^\w-]+", "_", name, flags=re.UNICODE).strip("_") or "person"
    person_directory = settings.face_photo_dir / directory_name
    person_directory.mkdir(parents=True, exist_ok=True)
    encoded, content = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
    if not encoded:
        raise OSError("Could not encode enrollment photo")
    (person_directory / f"{uuid4().hex}.jpg").write_bytes(content.tobytes())


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "modelLoaded": detector._model is not None,
        "faceEngine": "opencv-yunet-sface",
    }


@app.get("/faces")
async def enrolled_faces() -> dict:
    return {
        "names": face_store.names(),
        "needsReenrollment": face_store.needs_reenrollment(),
    }


@app.post("/faces/enroll", status_code=201)
async def enroll_face(name: str = Form(...), image: UploadFile = File(...)) -> dict:
    clean_name = name.strip()
    if not re.fullmatch(r"[\w .'-]{1,60}", clean_name, flags=re.UNICODE):
        raise HTTPException(status_code=400, detail="Name contains unsupported characters")
    frame, _ = await decode_upload(image)
    try:
        face_store.enroll(clean_name, frame)
        save_enrollment_photo(clean_name, frame)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except OSError as error:
        raise HTTPException(status_code=500, detail="Could not store enrollment photo") from error
    return {"message": f"Enrolled {clean_name}", "names": face_store.names()}


@app.post("/analyze")
async def analyze(
    image: UploadFile = File(...),
    classes: str = Form("person"),
    recognize_faces: bool = Form(True),
    tracking_id: str = Form(""),
) -> dict:
    frame, _ = await decode_upload(image)
    started = perf_counter()
    warnings: list[str] = []
    clean_tracking_id = tracking_id.strip()[:80] or None
    if recognize_faces and face_store.needs_reenrollment():
        warnings.append(
            "Dữ liệu khuôn mặt Dlib cũ không tương thích với SFace; hãy đăng ký lại khuôn mặt."
        )
    try:
        detections = detector.detect(frame, parse_classes(classes), clean_tracking_id)
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"Object detector unavailable: {error}") from error

    faces = []
    if recognize_faces:
        try:
            faces = face_store.recognize(frame, clean_tracking_id)
        except Exception as error:
            warnings.append(f"Face recognition unavailable: {error}")

    height, width = frame.shape[:2]
    return {
        "image": {"width": width, "height": height},
        "detections": detections,
        "faces": faces,
        "warnings": warnings,
        "processingMs": round((perf_counter() - started) * 1000),
    }
