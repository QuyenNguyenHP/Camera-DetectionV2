from __future__ import annotations

import asyncio
import re
from threading import Lock
from time import perf_counter
from typing import Annotated
from uuid import uuid4

import cv2

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .auth import AuthStore, UserExistsError
from .config import settings
from .detector import detector
from .faces import face_store
from .gestures import gesture_detector
from .home_assistant import home_assistant_controller
from .image_utils import decode_upload


app = FastAPI(title="Vision Guard ML Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    allow_credentials=True,
)


class LoginPayload(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class CreateUserPayload(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=12, max_length=128)
    role: str = Field(pattern="^(user|admin)$")


_auth_store: AuthStore | None = None
_auth_store_lock = Lock()


def get_auth_store() -> AuthStore:
    global _auth_store
    if _auth_store is None:
        with _auth_store_lock:
            if _auth_store is None:
                _auth_store = AuthStore(
                    settings.auth_database,
                    max(settings.auth_session_hours, 1) * 60 * 60,
                    settings.initial_admin_username,
                    settings.initial_admin_password,
                )
    return _auth_store


def current_user(
    request: Request,
    store: Annotated[AuthStore, Depends(get_auth_store)],
) -> dict:
    token = request.cookies.get(settings.auth_cookie_name, "")
    user = store.user_for_session(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def admin_user(user: Annotated[dict, Depends(current_user)]) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user


AuthenticatedUser = Annotated[dict, Depends(current_user)]
AdminUser = Annotated[dict, Depends(admin_user)]


def _clean_username(value: str) -> str:
    username = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{2,31}", username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-32 characters using letters, numbers, dot, dash or underscore",
        )
    return username


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
        "gestureEngine": "mediapipe",
        "gestureModelLoaded": gesture_detector._recognizer is not None,
    }


@app.get("/auth/status")
async def auth_status(store: Annotated[AuthStore, Depends(get_auth_store)]) -> dict:
    return {"setupRequired": store.user_count() == 0}


@app.post("/auth/login")
async def login(
    payload: LoginPayload,
    response: Response,
    store: Annotated[AuthStore, Depends(get_auth_store)],
) -> dict:
    if store.user_count() == 0:
        raise HTTPException(
            status_code=503,
            detail="No administrator exists. Set INITIAL_ADMIN_PASSWORD and restart the service.",
        )
    username = payload.username.strip().lower()
    user = store.authenticate(username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = store.create_session(user["id"])
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=max(settings.auth_session_hours, 1) * 60 * 60,
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite="strict",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return {"user": user}


@app.post("/auth/logout")
async def logout(
    request: Request,
    response: Response,
    store: Annotated[AuthStore, Depends(get_auth_store)],
) -> dict:
    token = request.cookies.get(settings.auth_cookie_name, "")
    if token:
        store.delete_session(token)
    response.delete_cookie(
        key=settings.auth_cookie_name,
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite="strict",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Clear-Site-Data"] = '"cache", "cookies", "storage"'
    return {"message": "Signed out"}


@app.get("/auth/me")
async def auth_me(user: AuthenticatedUser, response: Response) -> dict:
    response.headers["Cache-Control"] = "no-store"
    return {"user": user}


@app.get("/users")
async def users(_admin: AdminUser, store: Annotated[AuthStore, Depends(get_auth_store)]) -> dict:
    return {"users": store.list_users()}


@app.post("/users", status_code=201)
async def create_user(
    payload: CreateUserPayload,
    _admin: AdminUser,
    store: Annotated[AuthStore, Depends(get_auth_store)],
) -> dict:
    username = _clean_username(payload.username)
    try:
        user = store.create_user(username, payload.password, payload.role)
    except UserExistsError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"message": f"Created {username}", "user": user, "users": store.list_users()}


@app.get("/faces")
async def enrolled_faces(_admin: AdminUser) -> dict:
    return {
        "names": face_store.names(),
        "needsReenrollment": face_store.needs_reenrollment(),
    }


@app.post("/faces/enroll", status_code=201)
async def enroll_face(
    _admin: AdminUser,
    name: str = Form(...),
    image: UploadFile = File(...),
) -> dict:
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
    _user: AuthenticatedUser,
    image: UploadFile = File(...),
    classes: str = Form("person"),
    detect_objects: bool = Form(True),
    recognize_faces: bool = Form(True),
    detect_gestures: bool = Form(True),
    control_home: bool = Form(False),
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
    detections = []
    if detect_objects:
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

    hands = []
    if detect_gestures:
        try:
            hands = gesture_detector.detect(frame)
        except Exception as error:
            warnings.append(f"Hand gesture detection unavailable: {error}")

    home_control = {
        "enabled": False,
        "configured": home_assistant_controller.configured,
        "status": "disabled",
    }
    if control_home:
        if not detect_gestures:
            warnings.append("Điều khiển nhà cần bật nhận diện cử chỉ tay.")
        else:
            home_control = await asyncio.to_thread(
                home_assistant_controller.handle, hands, clean_tracking_id
            )
            if home_control["status"] == "error":
                warnings.append(home_control["message"])

    height, width = frame.shape[:2]
    return {
        "image": {"width": width, "height": height},
        "detections": detections,
        "faces": faces,
        "hands": hands,
        "homeControl": home_control,
        "warnings": warnings,
        "processingMs": round((perf_counter() - started) * 1000),
    }
