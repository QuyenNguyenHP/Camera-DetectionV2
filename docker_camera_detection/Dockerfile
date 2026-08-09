# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build


FROM python:3.12-slim-bookworm AS python-builder

ARG PYTORCH_VERSION=2.13.0
ARG TORCHVISION_VERSION=0.28.0

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH=/opt/venv/bin:$PATH

RUN apt-get update \
    && apt-get install --no-install-recommends -y git \
    && rm -rf /var/lib/apt/lists/* \
    && python -m venv /opt/venv

WORKDIR /build/backend
COPY backend/requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install \
        "torch==$PYTORCH_VERSION" \
        "torchvision==$TORCHVISION_VERSION" \
        --index-url https://download.pytorch.org/whl/cpu \
    && python -m pip install -r requirements.txt \
    && python -m pip uninstall --yes opencv-python opencv-python-headless \
    && python -m pip install --no-deps opencv-python-headless==4.11.0.86 \
    && python -c "import torch; assert torch.version.cuda is None, torch.version.cuda"


FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH=/opt/venv/bin:$PATH \
    CUDA_VISIBLE_DEVICES=-1 \
    YOLO_CONFIG_DIR=/tmp/ultralytics \
    MPLCONFIGDIR=/tmp/matplotlib \
    YOLO_MODEL=yolov8s-worldv2.pt \
    YOLO_DEVICE=cpu \
    FACE_STORE=data/faces.json \
    FACE_PHOTO_DIR=data/people \
    AUTH_DATABASE=data/users.db \
    AUTH_SESSION_HOURS=12 \
    AUTH_COOKIE_NAME=__Host-camera_session \
    AUTH_COOKIE_SECURE=true \
    YUNET_MODEL=models/face_detection_yunet_2023mar.onnx \
    SFACE_MODEL=models/face_recognition_sface_2021dec.onnx

RUN apt-get update \
    && apt-get install --no-install-recommends -y libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY --from=python-builder /opt/venv /opt/venv

COPY backend/vision_app ./vision_app
COPY backend/models ./models
COPY backend/yolov8s-worldv2.pt ./yolov8s-worldv2.pt
COPY docker_camera_detection/deployment_app.py ./deployment_app.py
COPY --from=frontend-builder /build/frontend/dist /app/frontend

RUN mkdir -p /app/backend/data/people /tmp/ultralytics /tmp/matplotlib \
    && useradd --create-home --uid 10001 camera \
    && chown -R camera:camera /app /tmp/ultralytics /tmp/matplotlib

USER camera
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=4)"]

CMD ["uvicorn", "deployment_app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--proxy-headers"]
