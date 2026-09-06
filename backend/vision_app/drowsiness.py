"""Experimental eye-closure monitoring, isolated per authenticated camera session."""
from collections import OrderedDict
from threading import Lock
from time import monotonic
import cv2
import numpy as np
from .config import settings


class EyeTimeline:
    def __init__(self):
        self.sessions = OrderedDict()

    def update(self, session, closed, now):
        previous = self.sessions.pop(session, None) if session else None
        duration = 0.0
        status = 'insufficient_data'
        if closed is not None:
            status = 'eyes_closed' if closed else 'eyes_open'
            if session and previous and 0 < now - previous[0] <= 1.0:
                if closed and previous[1]:
                    duration = previous[2] + now - previous[0]
            if duration >= settings.drowsiness_closed_seconds:
                status = 'possible_drowsiness'
        if session:
            self.sessions[session] = (now, closed, duration)
            while self.sessions and (len(self.sessions) > 64 or now - next(iter(self.sessions.values()))[0] > 120):
                self.sessions.popitem(last=False)
        return {'status': status, 'closedSeconds': round(duration, 2),
                'temporal': bool(session), 'alert': status == 'possible_drowsiness'}


class DrowsinessDetector:
    def __init__(self):
        self._model = None
        self._lock = Lock()
        self.timeline = EyeTimeline()

    def detect(self, image, session=None):
        import mediapipe as mp
        with self._lock:
            if self._model is None:
                if not settings.face_landmarker_model.is_file():
                    raise RuntimeError('Missing face_landmarker.task; run download_drowsiness_model.py')
                self._model = mp.tasks.vision.FaceLandmarker.create_from_options(
                    mp.tasks.vision.FaceLandmarkerOptions(
                        base_options=mp.tasks.BaseOptions(model_asset_path=str(settings.face_landmarker_model)),
                        running_mode=mp.tasks.vision.RunningMode.IMAGE,
                        num_faces=2, output_face_blendshapes=True,
                        min_face_detection_confidence=0.7, min_face_presence_confidence=0.7))
            result = self._model.detect(mp.Image(image_format=mp.ImageFormat.SRGB,
                data=np.ascontiguousarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))))
            closed = None
            reason = 'Cần đúng một khuôn mặt nhìn rõ vào camera.'
            scores = {}
            eyes = []
            if len(result.face_landmarks) == 1 and len(result.face_blendshapes) == 1:
                points = result.face_landmarks[0]
                # Reject tiny / clipped faces and strong sideways poses rather than infer alertness.
                eye_span = abs(points[33].x - points[263].x)
                nose_offset = abs(points[1].x - (points[33].x + points[263].x) / 2)
                if eye_span * image.shape[1] >= 40 and nose_offset < eye_span * 0.35 and all(
                    0 < points[i].x < 1 and 0 < points[i].y < 1 for i in (33, 133, 263, 362)):
                    values = {v.category_name: v.score for v in result.face_blendshapes[0]}
                    left, right = values.get('eyeBlinkLeft'), values.get('eyeBlinkRight')
                    if left is not None and right is not None:
                        for name, score, indices in (
                            ('left', left, (263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466)),
                            ('right', right, (33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246)),
                        ):
                            eyes.append({'side': name,
                                'state': 'closed' if score >= 0.6 else 'open' if score <= 0.35 else 'unknown',
                                'points': [{'x': float(points[i].x), 'y': float(points[i].y)} for i in indices]})
                        scores = {'leftClosure' : round(left, 3), 'rightClosure': round(right, 3)}
                        if min(left, right) >= 0.6:
                            closed, reason = True, 'Hai mắt đang nhắm.'
                        elif max(left, right) <= 0.35:
                            closed, reason = False, 'Hai mắt đang mở.'
                        else:
                            reason = 'Trạng thái mắt chưa rõ.'
            state = self.timeline.update(session, closed, monotonic())
            return {**state, **scores, 'eyes': eyes, 'message': reason}


drowsiness_detector = DrowsinessDetector()
