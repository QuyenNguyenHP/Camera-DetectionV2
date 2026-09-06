from types import SimpleNamespace
from unittest.mock import Mock

import cv2
import numpy as np
from fastapi.testclient import TestClient

from vision_app.main import app, current_user
from vision_app.poses import PoseDetector


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


def test_pose_api_opt_in_and_failure_warning(monkeypatch):
    detect = Mock(return_value=[{'label': 'person', 'keypoints': []}])
    monkeypatch.setattr('vision_app.main.pose_detector.detect', detect)
    app.dependency_overrides[current_user] = lambda: {'id': 1, 'role': 'user'}
    _, encoded = cv2.imencode('.jpg', np.zeros((64, 64, 3), dtype=np.uint8))
    data = {'detect_objects': 'false', 'recognize_faces': 'false', 'detect_gestures': 'false'}
    try:
        with TestClient(app) as client:
            def post():
                return client.post('/analyze', data=data, files={'image': ('test.jpg', encoded.tobytes(), 'image/jpeg')})
            response = post()
            assert response.status_code == 200
            assert response.json()['poses'] == []
            detect.assert_not_called()
            data['detect_poses'] = 'true'
            assert post().json()['poses'][0]['label'] == 'person'
            detect.side_effect = RuntimeError('missing model')
            response = post()
            assert response.status_code == 200
            assert response.json()['poses'] == []
            assert 'missing model' in response.json()['warnings'][0]
    finally:
        app.dependency_overrides.pop(current_user, None)
