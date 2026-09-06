"""Optional cigarette detector backed by a locally stored fine-tuned YOLO model."""

from threading import Lock
from typing import Any

import numpy as np

from .config import settings


class SmokingDetector:
    def __init__(self) -> None:
        self._model: Any | None = None
        self._lock = Lock()

    def detect(self, image: np.ndarray) -> list[dict[str, Any]]:
        with self._lock:
            if self._model is None:
                if not settings.smoking_model.is_file():
                    raise RuntimeError(f"Smoking model not found: {settings.smoking_model}")
                from ultralytics import YOLO

                self._model = YOLO(str(settings.smoking_model))
            result = self._model.predict(
                image,
                conf=settings.smoking_confidence,
                device=settings.yolo_device,
                imgsz=800,
                verbose=False,
            )[0]

        height, width = image.shape[:2]
        names = result.names
        detections: list[dict[str, Any]] = []
        for box in result.boxes:
            x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
            class_id = int(box.cls[0])
            detections.append({
                "label": str(names[class_id]).lower(),
                "confidence": round(float(box.conf[0]), 4),
                "box": {
                    "x": round(x1 / width, 6),
                    "y": round(y1 / height, 6),
                    "width": round((x2 - x1) / width, 6),
                    "height": round((y2 - y1) / height, 6),
                },
            })
        return detections


smoking_detector = SmokingDetector()
