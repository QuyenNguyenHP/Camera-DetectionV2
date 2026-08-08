from vision_app.detector import ObjectDetector


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

