#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname "$SCRIPT_DIR")
IMAGE_NAME=${IMAGE_NAME:-camera-detection}
IMAGE_VERSION=${IMAGE_VERSION:-1.1.0-cpu}
TARGET_PLATFORM=${TARGET_PLATFORM:-linux/amd64}
ARCHIVE_PATH="$SCRIPT_DIR/camera-detection-$IMAGE_VERSION.tar"
CHECKSUM_PATH="$ARCHIVE_PATH.sha256"
VALIDATION_CONTAINER="camera-detection-build-validation"

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required. Install Docker Engine or Docker Desktop first." >&2
  exit 1
}

for REQUIRED_FILE in \
  "$PROJECT_DIR/backend/yolov8s-worldv2.pt" \
  "$PROJECT_DIR/backend/models/face_detection_yunet_2023mar.onnx" \
  "$PROJECT_DIR/backend/models/face_recognition_sface_2021dec.onnx" \
  "$PROJECT_DIR/backend/models/gesture_recognizer.task"
do
  if [ ! -f "$REQUIRED_FILE" ]; then
    echo "Required model is missing: $REQUIRED_FILE" >&2
    exit 1
  fi
done

echo "Building $IMAGE_NAME:$IMAGE_VERSION for $TARGET_PLATFORM..."
docker build \
  --platform "$TARGET_PLATFORM" \
  --tag "$IMAGE_NAME:$IMAGE_VERSION" \
  --file "$SCRIPT_DIR/Dockerfile" \
  "$PROJECT_DIR"

echo "Validating Python libraries and packaged model files..."
docker run --rm "$IMAGE_NAME:$IMAGE_VERSION" python -c "\
from importlib import metadata; \
from pathlib import Path; \
import cv2, torch, ultralytics, clip, mediapipe; \
from vision_app.detector import detector; \
from vision_app.faces import face_store; \
from vision_app.gestures import gesture_detector; \
required = [Path('yolov8s-worldv2.pt'), Path('models/face_detection_yunet_2023mar.onnx'), Path('models/face_recognition_sface_2021dec.onnx'), Path('models/gesture_recognizer.task')]; \
assert all(path.is_file() and path.stat().st_size > 0 for path in required); \
cuda_packages = sorted(dist.metadata['Name'] for dist in metadata.distributions() if (dist.metadata['Name'] or '').lower().startswith('nvidia-')); \
triton_packages = sorted(dist.metadata['Name'] for dist in metadata.distributions() if (dist.metadata['Name'] or '').lower().startswith('triton')); \
assert torch.version.cuda is None, f'CUDA-enabled PyTorch detected: {torch.version.cuda}'; \
assert not cuda_packages, f'CUDA packages detected: {cuda_packages}'; \
assert not triton_packages, f'Triton packages detected: {triton_packages}'; \
detector._load(); \
face_store._load_models(); \
gesture_detector._load(); \
print(f'CPU-only libraries and YOLO/YuNet/SFace/MediaPipe models loaded successfully (torch={torch.__version__})')"

docker rm -f "$VALIDATION_CONTAINER" >/dev/null 2>&1 || true
cleanup_validation() {
  docker rm -f "$VALIDATION_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup_validation EXIT INT TERM

echo "Starting a temporary container for application health validation..."
docker run -d --name "$VALIDATION_CONTAINER" "$IMAGE_NAME:$IMAGE_VERSION" >/dev/null

ATTEMPT=0
until docker exec "$VALIDATION_CONTAINER" python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=4)" >/dev/null 2>&1
do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge 60 ]; then
    echo "Container health validation failed. Logs:" >&2
    docker logs "$VALIDATION_CONTAINER" >&2
    exit 1
  fi
  sleep 2
done
echo "Packaged frontend and API started successfully."
cleanup_validation
trap - EXIT INT TERM

echo "Exporting image to $ARCHIVE_PATH..."
docker save --output "$ARCHIVE_PATH" "$IMAGE_NAME:$IMAGE_VERSION"
(cd "$SCRIPT_DIR" && sha256sum "$(basename "$ARCHIVE_PATH")" > "$(basename "$CHECKSUM_PATH")")

echo "Portable image created: $ARCHIVE_PATH"
echo "Checksum created: $CHECKSUM_PATH"
echo "Copy docker_camera_detection to the target PC, then run ./load_and_run.sh"
