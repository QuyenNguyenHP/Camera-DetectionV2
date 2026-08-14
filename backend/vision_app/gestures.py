from __future__ import annotations

from threading import Lock
from typing import Any

import cv2
import numpy as np

from .config import settings


class GestureDetector:
    """Lazily load MediaPipe and recognize canned gestures on CPU."""

    def __init__(self) -> None:
        self._recognizer: Any | None = None
        self._lock = Lock()

    def _load(self) -> Any:
        if self._recognizer is None:
            if not settings.gesture_model.is_file():
                raise RuntimeError(f"Gesture model not found: {settings.gesture_model}")
            try:
                import mediapipe as mp
            except ImportError as error:
                raise RuntimeError("MediaPipe is not installed") from error

            options = mp.tasks.vision.GestureRecognizerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(settings.gesture_model)),
                running_mode=mp.tasks.vision.RunningMode.IMAGE,
                num_hands=max(1, settings.gesture_num_hands),
                min_hand_detection_confidence=settings.gesture_min_confidence,
                min_hand_presence_confidence=settings.gesture_min_confidence,
                min_tracking_confidence=settings.gesture_min_confidence,
                canned_gesture_classifier_options=mp.tasks.components.processors.ClassifierOptions(
                    score_threshold=settings.gesture_min_confidence,
                ),
            )
            self._recognizer = mp.tasks.vision.GestureRecognizer.create_from_options(options)
        return self._recognizer

    def detect(self, image: np.ndarray) -> list[dict[str, Any]]:
        import mediapipe as mp

        rgb = np.ascontiguousarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        media_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        with self._lock:
            result = self._load().recognize(media_image)

        hands: list[dict[str, Any]] = []
        for index, landmarks in enumerate(result.hand_landmarks):
            gesture = result.gestures[index][0] if index < len(result.gestures) and result.gestures[index] else None
            handedness = (
                result.handedness[index][0]
                if index < len(result.handedness) and result.handedness[index]
                else None
            )
            if gesture is None or gesture.category_name == "None":
                gesture_name = "Unknown"
                confidence = 0.0
            else:
                gesture_name = gesture.category_name
                confidence = float(gesture.score)

            points = [
                {"x": round(float(point.x), 6), "y": round(float(point.y), 6), "z": round(float(point.z), 6)}
                for point in landmarks
            ]
            xs = [point["x"] for point in points]
            ys = [point["y"] for point in points]
            padding = 0.025
            left = max(0.0, min(xs) - padding)
            top = max(0.0, min(ys) - padding)
            right = min(1.0, max(xs) + padding)
            bottom = min(1.0, max(ys) + padding)
            hands.append(
                {
                    "gesture": gesture_name,
                    "confidence": round(confidence, 4),
                    "handedness": handedness.category_name if handedness else "Unknown",
                    "box": {
                        "x": round(left, 6),
                        "y": round(top, 6),
                        "width": round(right - left, 6),
                        "height": round(bottom - top, 6),
                    },
                    "landmarks": points,
                }
            )
        return hands


gesture_detector = GestureDetector()
