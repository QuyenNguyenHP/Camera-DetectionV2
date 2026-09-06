"""Download Google's Face Landmarker model."""
from download_models import download, MODEL_DIR

if __name__ == '__main__':
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    download('face_landmarker.task', 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task')
