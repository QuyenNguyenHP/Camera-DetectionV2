import json

import numpy as np

from vision_app.faces import FaceStore, _iou


def test_iou_for_identical_boxes():
    assert _iou((0.1, 0.1, 0.3, 0.3), (0.1, 0.1, 0.3, 0.3)) == 1.0


def test_iou_for_separate_boxes():
    assert _iou((0.0, 0.0, 0.1, 0.1), (0.8, 0.8, 0.1, 0.1)) == 0.0


def test_legacy_dlib_store_requires_reenrollment(tmp_path):
    path = tmp_path / "faces.json"
    path.write_text(json.dumps([{"name": "Old", "encoding": [0.0] * 128}]))
    store = FaceStore(path)
    assert store.needs_reenrollment() is True
    assert store.names() == []


def test_tracking_reuses_identity_between_frames(tmp_path):
    store = FaceStore(tmp_path / "faces.json")
    face = np.asarray([10, 10, 20, 20], dtype=np.float32)
    calls = {"embeddings": 0}
    store._detect = lambda _image: [face]

    def embedding(_image, _face):
        calls["embeddings"] += 1
        return np.ones(128, dtype=np.float32)

    store._embedding = embedding
    store._match = lambda _embedding: ("Alice", 0.91)
    image = np.zeros((100, 100, 3), dtype=np.uint8)

    first = store.recognize(image, "camera-session")
    second = store.recognize(image, "camera-session")

    assert first[0]["trackId"] == second[0]["trackId"] == 1
    assert second[0]["name"] == "Alice"
    assert calls["embeddings"] == 1
