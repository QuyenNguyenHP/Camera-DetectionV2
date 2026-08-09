#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
IMAGE_NAME=${IMAGE_NAME:-camera-detection}
IMAGE_VERSION=${IMAGE_VERSION:-1.1.0-cpu}
ARCHIVE_PATH=${ARCHIVE_PATH:-$SCRIPT_DIR/camera-detection-$IMAGE_VERSION.tar}

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required. Install Docker Engine or Docker Desktop first." >&2
  exit 1
}

if [ ! -f "$ARCHIVE_PATH" ]; then
  echo "Image archive not found: $ARCHIVE_PATH" >&2
  exit 1
fi

if [ -f "$ARCHIVE_PATH.sha256" ]; then
  echo "Verifying image archive checksum..."
  (cd "$(dirname "$ARCHIVE_PATH")" && sha256sum --check "$(basename "$ARCHIVE_PATH").sha256")
fi

docker load --input "$ARCHIVE_PATH"
cd "$SCRIPT_DIR"
export CAMERA_IMAGE="$IMAGE_NAME:$IMAGE_VERSION"
docker compose up -d

PORT=${CAMERA_APP_PORT:-8080}
echo "Camera Detection is starting at http://localhost:$PORT"
echo "Check status with: docker compose ps"
