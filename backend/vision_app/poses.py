"""CPU body pose estimation; this stage does not classify falls."""
from threading import Lock

from .config import settings

KEYPOINT_NAMES = (
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
)


class PoseDetector:
    def __init__(self):
        self._model = None
        self._lock = Lock()

    def detect(self, image):
        with self._lock:
            if self._model is None:
                if not settings.pose_model.is_file():
                    raise RuntimeError("Pose model missing. Run python download_pose_model.py in backend.")
                from ultralytics import YOLO
                self._model = YOLO(str(settings.pose_model), task="pose")
            result = self._model.predict(
                image, device="cpu", imgsz=640, conf=settings.confidence, verbose=False,
            )[0]
        if result.keypoints is None or result.boxes is None:
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
        return poses


pose_detector = PoseDetector()
