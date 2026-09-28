from types import SimpleNamespace
from unittest.mock import Mock

import cv2
import numpy as np
from fastapi.testclient import TestClient

from vision_app.main import app, current_user
from vision_app.poses import PoseDetector


def _pose(horizontal: bool) -> dict:
    box = {"x": 0.1, "y": 0.1, "width": 0.7 if horizontal else 0.3,
           "height": 0.3 if horizontal else 0.8}
    coordinates = {
        "nose": (0.25, 0.48 if horizontal else 0.10),
        "left_shoulder": (0.35, 0.45 if horizontal else 0.30),
        "right_shoulder": (0.35, 0.55 if horizontal else 0.30),
        "left_hip": (0.65, 0.45 if horizontal else 0.65),
        "right_hip": (0.65, 0.55 if horizontal else 0.65),
    }
    return {"box": box, "keypoints": [
        {"name": name, "x": coordinates.get(name, (0, 0))[0],
         "y": coordinates.get(name, (0, 0))[1],
         "confidence": 0.9 if name in coordinates else 0.0}
        for name in __import__("vision_app.poses", fromlist=["KEYPOINT_NAMES"]).KEYPOINT_NAMES
    ]}


def test_pose_coordinates_are_normalized():
    detector = PoseDetector()
    box = SimpleNamespace(xyxy=np.array([[20, 10, 100, 90]]), conf=[0.9])
    result = SimpleNamespace(boxes=[box], keypoints=SimpleNamespace(
        data=np.array([[[50, 25, 0.8]] * 17])))
    detector._model = Mock()
    detector._model.predict.return_value = [result]
    poses = detector.detect(np.zeros((100, 200, 3), dtype=np.uint8))
    assert poses[0]['box'] == {'x': 0.1, 'y': 0.1, 'width': 0.4, 'height': 0.8}
    assert len(poses[0]['keypoints']) == 17
    assert poses[0]['keypoints'][0] == {'name': 'nose', 'x': 0.25, 'y': 0.25, 'confidence': 0.8}
    assert detector._model.predict.call_args.kwargs['device'] == 'cpu'
    assert poses[0]['fall']['temporal'] is False


def test_pose_api_is_always_enabled_and_failure_is_warning(monkeypatch):
    detect = Mock(return_value=[{'label': 'person', 'keypoints': []}])
    monkeypatch.setattr('vision_app.main.pose_detector.detect', detect)
    app.dependency_overrides[current_user] = lambda: {'id': 1, 'role': 'user'}
    _, encoded = cv2.imencode('.jpg', np.zeros((64, 64, 3), dtype=np.uint8))
    data = {'recognize_faces': 'false', 'notify_home': 'false'}
    try:
        with TestClient(app) as client:
            def post():
                return client.post('/analyze', data=data, files={'image': ('test.jpg', encoded.tobytes(), 'image/jpeg')})
            response = post()
            assert response.status_code == 200
            assert response.json()['poses'][0]['label'] == 'person'
            detect.assert_called_once()
            detect.side_effect = RuntimeError('missing model')
            response = post()
            assert response.status_code == 200
            assert response.json()['poses'] == []
            assert 'missing model' in response.json()['warnings'][0]
    finally:
        app.dependency_overrides.pop(current_user, None)


def test_fall_confirmation_and_recovery_use_elapsed_seconds(monkeypatch):
    detector = PoseDetector()
    clock = iter([10.0, 11.0, 11.5, 12.0, 12.5])
    monkeypatch.setattr("vision_app.poses.monotonic", lambda: next(clock))

    statuses = []
    for horizontal in [True, True, True, False, False]:
        pose = _pose(horizontal)
        detector._classify([pose], "camera-1")
        statuses.append(pose["fall"]["status"])

    assert statuses == ["suspected", "suspected", "confirmed", "confirmed", "upright"]


def test_long_detection_gap_resets_pending_confirmation(monkeypatch):
    detector = PoseDetector()
    clock = iter([10.0, 11.0, 13.0, 14.0])
    monkeypatch.setattr("vision_app.poses.monotonic", lambda: next(clock))

    statuses = []
    for _ in range(4):
        pose = _pose(True)
        detector._classify([pose], "camera-1")
        statuses.append(pose["fall"]["status"])

    assert statuses == ["suspected", "suspected", "suspected", "suspected"]
