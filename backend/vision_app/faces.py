from __future__ import annotations

import json
from pathlib import Path
from threading import RLock
from typing import Any

import cv2
import numpy as np

from .config import settings


def _iou(first: tuple[float, float, float, float], second: tuple[float, float, float, float]) -> float:
    ax, ay, aw, ah = first
    bx, by, bw, bh = second
    left, top = max(ax, bx), max(ay, by)
    right, bottom = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    union = aw * ah + bw * bh - intersection
    return min(max(intersection / union, 0.0), 1.0) if union > 0 else 0.0


class FaceStore:
    """YuNet detection, SFace embeddings, JSON enrollment and lightweight tracking."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = RLock()
        self._records: list[dict[str, Any]] = []
        self._legacy_store = False
        self._detector: Any | None = None
        self._recognizer: Any | None = None
        self._sessions: dict[str, dict[str, Any]] = {}
        self._request_index = 0
        self._load_store()

    def _load_store(self) -> None:
        if not self.path.exists():
            return
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return

        if isinstance(payload, dict) and payload.get("model") == "sface":
            records = payload.get("records", [])
            if isinstance(records, list):
                self._records = records
        elif isinstance(payload, list):
            # Định dạng v1 là embedding Dlib và không thể so sánh với SFace.
            self._legacy_store = True

    def _load_models(self) -> None:
        if self._detector is not None and self._recognizer is not None:
            return
        missing = [path for path in (settings.yunet_model, settings.sface_model) if not path.exists()]
        if missing:
            names = ", ".join(str(path) for path in missing)
            raise RuntimeError(
                f"Thiếu model ONNX: {names}. Chạy: python3 download_models.py"
            )

        self._detector = cv2.FaceDetectorYN.create(
            str(settings.yunet_model),
            "",
            (320, 320),
            settings.yunet_score_threshold,
            0.3,
            5000,
        )
        self._recognizer = cv2.FaceRecognizerSF.create(str(settings.sface_model), "")

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self._legacy_store and self.path.exists():
            backup = self.path.with_name(f"{self.path.stem}.dlib-backup.json")
            if not backup.exists():
                backup.write_text(self.path.read_text(encoding="utf-8"), encoding="utf-8")
            self._legacy_store = False

        payload = {"version": 2, "model": "sface", "records": self._records}
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(payload), encoding="utf-8")
        temporary.replace(self.path)

    def _detect(self, image: np.ndarray) -> list[np.ndarray]:
        self._load_models()
        height, width = image.shape[:2]
        self._detector.setInputSize((width, height))
        _, faces = self._detector.detect(image)
        return [] if faces is None else [face for face in faces]

    def _embedding(self, image: np.ndarray, face: np.ndarray) -> np.ndarray:
        aligned = self._recognizer.alignCrop(image, face)
        feature = self._recognizer.feature(aligned).reshape(-1).astype(np.float32)
        norm = float(np.linalg.norm(feature))
        if norm == 0:
            raise ValueError("Không thể tạo embedding cho khuôn mặt")
        return feature / norm

    def _match(self, embedding: np.ndarray) -> tuple[str, float | None]:
        if not self._records:
            return "Unknown", None
        known = np.asarray([record["embedding"] for record in self._records], dtype=np.float32)
        known /= np.maximum(np.linalg.norm(known, axis=1, keepdims=True), 1e-12)
        similarities = known @ embedding
        best = int(np.argmax(similarities))
        similarity = float(similarities[best])
        name = self._records[best]["name"] if similarity >= settings.face_similarity_threshold else "Unknown"
        return name, similarity

    @staticmethod
    def _normalized_box(face: np.ndarray, width: int, height: int) -> tuple[float, float, float, float]:
        x, y, box_width, box_height = [float(value) for value in face[:4]]
        x = min(max(x / width, 0.0), 1.0)
        y = min(max(y / height, 0.0), 1.0)
        box_width = min(max(box_width / width, 0.0), 1.0 - x)
        box_height = min(max(box_height / height, 0.0), 1.0 - y)
        return x, y, box_width, box_height

    def names(self) -> list[str]:
        with self._lock:
            return sorted({record["name"] for record in self._records})

    def needs_reenrollment(self) -> bool:
        with self._lock:
            return self._legacy_store

    def enroll(self, name: str, image: np.ndarray) -> None:
        with self._lock:
            faces = self._detect(image)
            if len(faces) != 1:
                raise ValueError("Ảnh đăng ký phải chứa đúng một khuôn mặt rõ ràng")
            embedding = self._embedding(image, faces[0])
            self._records.append({"name": name, "embedding": embedding.tolist()})
            self._sessions.clear()
            self._save()

    @staticmethod
    def _result(
        box: tuple[float, float, float, float],
        name: str,
        similarity: float | None,
        track_id: int | None,
    ) -> dict[str, Any]:
        x, y, box_width, box_height = box
        return {
            "trackId": track_id,
            "name": name,
            "similarity": round(similarity, 4) if similarity is not None else None,
            "box": {
                "x": round(x, 6),
                "y": round(y, 6),
                "width": round(box_width, 6),
                "height": round(box_height, 6),
            },
        }

    def recognize(self, image: np.ndarray, tracking_id: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            faces = self._detect(image)
            height, width = image.shape[:2]
            self._request_index += 1

            # Ảnh upload không có phiên tracking: luôn tạo embedding mới để tránh
            # mang danh tính từ một ảnh không liên quan sang ảnh tiếp theo.
            if not tracking_id:
                results = []
                for face in faces:
                    embedding = self._embedding(image, face)
                    name, similarity = self._match(embedding)
                    box = self._normalized_box(face, width, height)
                    results.append(self._result(box, name, similarity, None))
                return results

            session = self._sessions.setdefault(
                tracking_id,
                {"tracks": {}, "next_track_id": 1, "frame_index": 0, "last_used": 0},
            )
            session["frame_index"] += 1
            session["last_used"] = self._request_index
            tracks = session["tracks"]
            used_tracks: set[int] = set()
            results: list[dict[str, Any]] = []

            for face in faces:
                box = self._normalized_box(face, width, height)
                candidates = [
                    (track_id, _iou(box, track["box"]))
                    for track_id, track in tracks.items()
                    if track_id not in used_tracks
                ]
                track_id, overlap = max(candidates, key=lambda item: item[1], default=(0, 0.0))

                if overlap < settings.track_iou_threshold:
                    track_id = session["next_track_id"]
                    session["next_track_id"] += 1
                    tracks[track_id] = {
                        "box": box,
                        "name": "Unknown",
                        "similarity": None,
                        "last_recognized": -settings.face_recognition_interval,
                        "missed": 0,
                    }

                track = tracks[track_id]
                should_recognize = (
                    session["frame_index"] - track["last_recognized"]
                    >= settings.face_recognition_interval
                )
                if should_recognize:
                    embedding = self._embedding(image, face)
                    track["name"], track["similarity"] = self._match(embedding)
                    track["last_recognized"] = session["frame_index"]

                track["box"] = box
                track["missed"] = 0
                used_tracks.add(track_id)
                results.append(self._result(box, track["name"], track["similarity"], track_id))

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

            return results


face_store = FaceStore(settings.face_store)
