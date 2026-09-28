from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv


load_dotenv()


def _env_bool(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    pose_model: Path = Path(os.getenv("POSE_MODEL", str(Path(__file__).resolve().parents[1] / "models" / "yolo26n-pose.pt")))
    pose_image_size: int = int(os.getenv("POSE_IMAGE_SIZE", "512"))
    pose_confidence: float = float(os.getenv("POSE_CONFIDENCE", "0.45"))
    fall_confirm_seconds: float = max(0.1, float(os.getenv("FALL_CONFIRM_SECONDS", "1.5")))
    fall_recovery_seconds: float = max(0.1, float(os.getenv("FALL_RECOVERY_SECONDS", "1.0")))
    fall_max_frame_gap_seconds: float = max(0.1, float(os.getenv("FALL_MAX_FRAME_GAP_SECONDS", "1.0")))
    fall_bbox_ratio: float = float(os.getenv("FALL_BBOX_RATIO", "1.15"))
    fall_torso_angle: float = float(os.getenv("FALL_TORSO_ANGLE", "35"))
    max_upload_bytes: int = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
    face_store: Path = Path(os.getenv("FACE_STORE", "data/faces.json"))
    face_photo_dir: Path = Path(os.getenv("FACE_PHOTO_DIR", "data/people"))
    yunet_model: Path = Path(
        os.getenv("YUNET_MODEL", "models/face_detection_yunet_2023mar.onnx")
    )
    sface_model: Path = Path(
        os.getenv("SFACE_MODEL", "models/face_recognition_sface_2021dec.onnx")
    )
    yunet_score_threshold: float = float(os.getenv("YUNET_SCORE_THRESHOLD", "0.80"))
    face_similarity_threshold: float = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.40"))
    face_recognition_interval: int = int(os.getenv("FACE_RECOGNITION_INTERVAL", "8"))
    track_iou_threshold: float = float(os.getenv("TRACK_IOU_THRESHOLD", "0.25"))
    track_max_missed: int = int(os.getenv("TRACK_MAX_MISSED", "3"))
    home_assistant_url: str = os.getenv("HA_URL", "").strip().rstrip("/")
    home_assistant_token: str = os.getenv("HA_TOKEN", "").strip()
    home_assistant_event: str = os.getenv("HA_FALL_EVENT", "vision_guard_fall").strip()
    home_alert_cooldown_seconds: float = float(os.getenv("HA_ALERT_COOLDOWN_SECONDS", "60"))
    auth_database: Path = Path(os.getenv("AUTH_DATABASE", "data/users.db"))
    auth_session_hours: int = int(os.getenv("AUTH_SESSION_HOURS", "12"))
    auth_cookie_name: str = os.getenv("AUTH_COOKIE_NAME", "camera_session")
    auth_cookie_secure: bool = _env_bool("AUTH_COOKIE_SECURE", "false")
    initial_admin_username: str = os.getenv("INITIAL_ADMIN_USERNAME", "admin")
    initial_admin_password: str = os.getenv("INITIAL_ADMIN_PASSWORD", "")


settings = Settings()
