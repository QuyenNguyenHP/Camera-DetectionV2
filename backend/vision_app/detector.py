from __future__ import annotations

from threading import Lock
from typing import Any

import numpy as np

from .config import settings


class ObjectDetector:
    """Lazily loads YOLO-World so health checks stay fast."""

    def __init__(self) -> None:
        self._model: Any | None = None
        self._classes: tuple[str, ...] = ()
        self._lock = Lock()
        self._tracking_lock = Lock()
        self._sessions: dict[str, dict[str, Any]] = {}
        self._request_index = 0

    def _load(self) -> Any:
        if self._model is None:
            try:
                import clip  # noqa: F401
            except ImportError as error:
                raise RuntimeError(
                    "Thiếu Ultralytics CLIP. Chạy backend/.venv/bin/python -m pip "
                    "install 'git+https://github.com/ultralytics/CLIP.git'"
                ) from error

            from ultralytics import YOLOWorld

            self._model = YOLOWorld(settings.model_name)
        return self._model

    @staticmethod
    def _iou(first: dict[str, float], second: dict[str, float]) -> float:
        left = max(first["x"], second["x"])
        top = max(first["y"], second["y"])
        right = min(first["x"] + first["width"], second["x"] + second["width"])
        bottom = min(first["y"] + first["height"], second["y"] + second["height"])
        intersection = max(0.0, right - left) * max(0.0, bottom - top)
        first_area = first["width"] * first["height"]
        second_area = second["width"] * second["height"]
        union = first_area + second_area - intersection
        return min(max(intersection / union, 0.0), 1.0) if union > 0 else 0.0

    def _track(self, detections: list[dict[str, Any]], tracking_id: str) -> None:
        with self._tracking_lock:
            self._request_index += 1
            session = self._sessions.setdefault(
                tracking_id,
                {"tracks": {}, "next_track_id": 1, "last_used": 0},
            )
            session["last_used"] = self._request_index
            tracks = session["tracks"]
            used_tracks: set[int] = set()

            for detection in detections:
                candidates = [
                    (track_id, self._iou(detection["box"], track["box"]))
                    for track_id, track in tracks.items()
                    if track_id not in used_tracks and track["label"] == detection["label"]
                ]
                track_id, overlap = max(candidates, key=lambda item: item[1], default=(0, 0.0))
                if overlap < settings.track_iou_threshold:
                    track_id = session["next_track_id"]
                    session["next_track_id"] += 1
                    tracks[track_id] = {"label": detection["label"], "box": detection["box"], "missed": 0}

                tracks[track_id]["box"] = detection["box"]
                tracks[track_id]["missed"] = 0
                used_tracks.add(track_id)
                detection["trackId"] = track_id

            for track_id in list(tracks):
                if track_id in used_tracks:
                    continue
                tracks[track_id]["missed"] += 1
                if tracks[track_id]["missed"] > settings.track_max_missed:
                    del tracks[track_id]

            if len(self._sessions) > 32:
                oldest = min(self._sessions, key=lambda key: self._sessions[key]["last_used"])
                if oldest != tracking_id:
                    del self._sessions[oldest]

    def detect(
        self,
        image: np.ndarray,
        requested: list[str],
        tracking_id: str | None = None,
    ) -> list[dict[str, Any]]:
        classes = tuple(dict.fromkeys(["person", *requested]))
        with self._lock:
            model = self._load()
            if classes != self._classes:
                model.set_classes(list(classes))
                self._classes = classes
            result = model.predict(
                image,
                conf=settings.confidence,
                device=settings.yolo_device,
                verbose=False,
            )[0]

        names = result.names
        height, width = image.shape[:2]
        detections: list[dict[str, Any]] = []
        for box in result.boxes:
            x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
            class_id = int(box.cls[0])
            detections.append(
                {
                    "label": names[class_id],
                    "confidence": round(float(box.conf[0]), 4),
                    "box": {
                        "x": round(x1 / width, 6),
                        "y": round(y1 / height, 6),
                        "width": round((x2 - x1) / width, 6),
                        "height": round((y2 - y1) / height, 6),
                    },
                }
            )
        if tracking_id:
            self._track(detections, tracking_id)
        return detections


detector = ObjectDetector()
