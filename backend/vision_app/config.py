from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    model_name: str = os.getenv("YOLO_MODEL", "yolov8s-worldv2.pt")
    confidence: float = float(os.getenv("DETECTION_CONFIDENCE", "0.30"))
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


settings = Settings()
