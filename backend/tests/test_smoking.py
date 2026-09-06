from types import SimpleNamespace
from unittest.mock import Mock

import numpy as np

from vision_app.smoking import SmokingDetector


def test_smoking_detector_normalizes_boxes():
    detector = SmokingDetector()
    box = SimpleNamespace(
        xyxy=np.array([[20, 10, 100, 90]]), conf=[0.91], cls=[0]
    )
    detector._model = Mock()
    detector._model.predict.return_value = [SimpleNamespace(
        boxes=[box], names={0: "cigarette"}
    )]

    detections = detector.detect(np.zeros((100, 200, 3), dtype=np.uint8))

    assert detections == [{
        "label": "cigarette", "confidence": 0.91,
        "box": {"x": 0.1, "y": 0.1, "width": 0.4, "height": 0.8},
    }]
    assert detector._model.predict.call_args.kwargs["imgsz"] == 800
