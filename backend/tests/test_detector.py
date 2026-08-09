import numpy as np

from vision_app.detector import ObjectDetector


class _EmptyResult:
    names = {}
    boxes = []


class _FakeModel:
    def __init__(self):
        self.predict_options = {}

    def set_classes(self, _classes):
        pass

    def predict(self, _image, **options):
        self.predict_options = options
        return [_EmptyResult()]


def test_object_tracker_keeps_id_for_overlapping_box():
    detector = ObjectDetector()
    first = [{"label": "person", "box": {"x": 0.1, "y": 0.1, "width": 0.3, "height": 0.6}}]
    second = [{"label": "person", "box": {"x": 0.12, "y": 0.1, "width": 0.3, "height": 0.6}}]

    detector._track(first, "camera")
    detector._track(second, "camera")

    assert first[0]["trackId"] == second[0]["trackId"] == 1


def test_object_tracker_does_not_mix_labels():
    detector = ObjectDetector()
    person = [{"label": "person", "box": {"x": 0.1, "y": 0.1, "width": 0.3, "height": 0.6}}]
    car = [{"label": "car", "box": {"x": 0.1, "y": 0.1, "width": 0.3, "height": 0.6}}]

    detector._track(person, "camera")
    detector._track(car, "camera")

    assert person[0]["trackId"] != car[0]["trackId"]


def test_detection_explicitly_uses_cpu(monkeypatch):
    detector = ObjectDetector()
    model = _FakeModel()
    monkeypatch.setattr(detector, "_load", lambda: model)

    detector.detect(np.zeros((8, 8, 3), dtype="uint8"), ["person"])

    assert model.predict_options["device"] == "cpu"
