"""CPU pose estimation and conservative, temporal fall classification."""
from __future__ import annotations

from dataclasses import dataclass
from math import atan2, degrees
from threading import Lock
from time import monotonic
from typing import Any

from .config import settings

KEYPOINT_NAMES = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
)


@dataclass
class _FallState:
    box: dict[str, float]
    suspected_since: float | None = None
    upright_since: float | None = None
    last_seen_at: float = 0.0
    confirmed: bool = False
    missed: int = 0


class PoseDetector:
    def __init__(self):
        self._model = None
        self._lock = Lock()
        self._state_lock = Lock()
        self._sessions: dict[str, dict[int, _FallState]] = {}
        self._next_track_id = 1

    @staticmethod
    def _iou(first: dict[str, float], second: dict[str, float]) -> float:
        left, top = max(first["x"], second["x"]), max(first["y"], second["y"])
        right = min(first["x"] + first["width"], second["x"] + second["width"])
        bottom = min(first["y"] + first["height"], second["y"] + second["height"])
        intersection = max(0.0, right - left) * max(0.0, bottom - top)
        union = first["width"] * first["height"] + second["width"] * second["height"] - intersection
        return intersection / union if union > 0 else 0.0

    @staticmethod
    def _point(points: list[dict[str, Any]], *names: str) -> tuple[float, float] | None:
        selected = [p for p in points if p["name"] in names and p["confidence"] >= 0.45]
        if not selected:
            return None
        return (sum(p["x"] for p in selected) / len(selected), sum(p["y"] for p in selected) / len(selected))

    def _fall_evidence(self, pose: dict[str, Any]) -> tuple[bool, dict[str, Any]]:
        box, points = pose["box"], pose["keypoints"]
        aspect_ratio = box["width"] / max(box["height"], 1e-6)
        shoulders = self._point(points, "left_shoulder", "right_shoulder")
        hips = self._point(points, "left_hip", "right_hip")
        head = self._point(points, "nose", "left_eye", "right_eye", "left_ear", "right_ear")
        torso_angle = None
        if shoulders and hips:
            torso_angle = abs(degrees(atan2(hips[1] - shoulders[1], hips[0] - shoulders[0])))
            torso_angle = min(torso_angle, 180 - torso_angle)
        head_hip_delta = abs(head[1] - hips[1]) if head and hips else None
        signals = [aspect_ratio >= settings.fall_bbox_ratio]
        if torso_angle is not None:
            signals.append(torso_angle <= settings.fall_torso_angle)
        if head_hip_delta is not None:
            signals.append(head_hip_delta <= max(box["height"] * 0.35, 0.04))
        suspected = len(signals) >= 2 and sum(signals) >= 2
        return suspected, {"aspectRatio": round(aspect_ratio, 3),
                           "torsoAngle": round(torso_angle, 1) if torso_angle is not None else None,
                           "signals": sum(signals)}

    def _classify(self, poses: list[dict[str, Any]], session_id: str | None) -> None:
        if not session_id:
            for pose in poses:
                suspected, evidence = self._fall_evidence(pose)
                pose["fall"] = {"status": "suspected" if suspected else "upright", "alert": False,
                                "temporal": False, "evidence": evidence}
            return
        with self._state_lock:
            now = monotonic()
            tracks = self._sessions.setdefault(session_id, {})
            used: set[int] = set()
            for pose in poses:
                candidate, overlap = max(
                    ((track_id, self._iou(pose["box"], state.box)) for track_id, state in tracks.items()
                     if track_id not in used), key=lambda item: item[1], default=(0, 0.0))
                if overlap < 0.25:
                    candidate = self._next_track_id
                    self._next_track_id += 1
                    tracks[candidate] = _FallState(box=pose["box"])
                state = tracks[candidate]
                if state.last_seen_at and now - state.last_seen_at > settings.fall_max_frame_gap_seconds:
                    state.suspected_since = None
                    state.upright_since = None
                    state.confirmed = False
                state.box, state.missed = pose["box"], 0
                state.last_seen_at = now
                suspected, evidence = self._fall_evidence(pose)
                if suspected:
                    state.upright_since = None
                    if state.suspected_since is None:
                        state.suspected_since = now
                    suspected_seconds = now - state.suspected_since
                    if suspected_seconds >= settings.fall_confirm_seconds:
                        state.confirmed = True
                else:
                    state.suspected_since = None
                    if state.upright_since is None:
                        state.upright_since = now
                    suspected_seconds = 0.0
                    if now - state.upright_since >= settings.fall_recovery_seconds:
                        state.confirmed = False
                pose["trackId"] = candidate
                pose["fall"] = {"status": "confirmed" if state.confirmed else "suspected" if suspected else "upright",
                                "alert": state.confirmed, "temporal": True,
                                "suspectedSeconds": round(suspected_seconds, 3), "evidence": evidence}
                used.add(candidate)
            for track_id in list(tracks):
                if track_id not in used:
                    tracks[track_id].missed += 1
                    if now - tracks[track_id].last_seen_at > settings.fall_max_frame_gap_seconds:
                        tracks[track_id].suspected_since = None
                        tracks[track_id].upright_since = None
                        tracks[track_id].confirmed = False
                    if tracks[track_id].missed > 5:
                        del tracks[track_id]
            if len(self._sessions) > 32:
                self._sessions.pop(next(iter(self._sessions)))

    def detect(self, image, tracking_id: str | None = None):
        with self._lock:
            if self._model is None:
                if not settings.pose_model.is_file():
                    raise RuntimeError("Pose model missing. Run python download_pose_model.py in backend.")
                from ultralytics import YOLO
                self._model = YOLO(str(settings.pose_model), task="pose")
            result = self._model.predict(
                image, device="cpu", imgsz=settings.pose_image_size,
                conf=settings.pose_confidence, verbose=False,
            )[0]
        if result.keypoints is None or result.boxes is None:
            self._classify([], tracking_id)
            return []
        height, width = image.shape[:2]
        poses = []
        for box, points in zip(result.boxes, result.keypoints.data.tolist()):
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            poses.append({
                "label": "person", "confidence": round(float(box.conf[0]), 4),
                "box": {"x": x1 / width, "y": y1 / height,
                        "width": (x2 - x1) / width, "height": (y2 - y1) / height},
                "keypoints": [
                    {"name": name, "x": x / width, "y": y / height, "confidence": confidence}
                    for name, (x, y, confidence) in zip(KEYPOINT_NAMES, points)
                ],
            })
        self._classify(poses, tracking_id)
        return poses


pose_detector = PoseDetector()
