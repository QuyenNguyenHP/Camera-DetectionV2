# Technology Stack

Vision Guard is a CPU-only, full-stack computer-vision application. The browser captures or uploads images, the FastAPI service performs object and face analysis, and results are returned as JSON for the React UI to render.

## Stack at a glance

| Layer | Technologies | Purpose |
| --- | --- | --- |
| Frontend | React 19, JavaScript (ES modules), Vite 6 | Single-page user interface, camera capture, enrollment, and detection overlays |
| UI support | Lucide React, browser MediaDevices API, Fetch API | Icons, webcam access, and HTTP requests |
| Backend | Python 3.10-3.12, FastAPI, Uvicorn, Pydantic | REST API, validation, authentication, and application hosting |
| Object detection | Ultralytics 8, YOLO-World (`yolov8s-worldv2.pt`), PyTorch CPU, Ultralytics CLIP | Open-vocabulary person and object detection |
| Face processing | OpenCV YuNet and SFace, ONNX models, NumPy | Face detection, embeddings, recognition, and IoU-based tracking |
| Image processing | OpenCV Headless, Pillow, NumPy | Image decoding, validation, conversion, and annotation data |
| Persistence | SQLite, JSON, local filesystem | Users and sessions, face embeddings, and enrollment photos |
| Security | pwdlib with Argon2, opaque server-side sessions, HTTP-only cookies | Password hashing and role-based authenticated access |
| Testing | Vitest, Testing Library, jsdom, pytest | Frontend component and backend API/unit tests |
| Packaging | Docker, Docker Compose, multi-stage builds | Portable CPU-only production image and persistent data volume |
| Development tooling | npm, Concurrently, Python virtual environment | Dependency management and combined local development |

## Frontend

- **React 19.1** and **React DOM 19.1** provide the component-based user interface.
- **Vite 6.3** supplies the development server and production bundling.
- The application uses plain **JavaScript/JSX** with native ES modules; it does not use TypeScript or a client-side state-management library.
- The browser's **MediaDevices API** accesses webcams, while `fetch`, `FormData`, and cookie credentials communicate directly with the backend.
- **Lucide React** supplies interface icons.
- The UI contains login, scan, and identity-enrollment flows, including canvas-style detection overlays.

## Backend and API

- **Python** is the backend language. Local development supports Python 3.10-3.12; the production container uses Python 3.12.
- **FastAPI 0.115** exposes REST endpoints for authentication, users, enrolled faces, health checks, and image analysis.
- **Pydantic**, included through FastAPI, validates JSON request models.
- **Uvicorn 0.34** runs the ASGI application.
- **python-multipart** handles uploaded images and form data, and **python-dotenv** loads environment-based configuration.
- Development uses CORS for the Vite origins. In production, one FastAPI application mounts the API under `/api` and serves the compiled frontend as static files from `/`.

## Computer vision and machine learning

### Object detection

- **YOLO-World** with `yolov8s-worldv2.pt` performs open-vocabulary object detection from user-provided class names.
- **Ultralytics 8.3.152** provides model loading and inference.
- **PyTorch** and **Torchvision** run inference exclusively on the CPU. The Docker build pins PyTorch 2.13.0 and Torchvision 0.28.0 from the official CPU wheel index; local development installs the compatible CPU releases separately.
- **Ultralytics CLIP** supplies the text/image representation required by YOLO-World.

### Face detection and recognition

- **OpenCV YuNet** detects faces using the `face_detection_yunet_2023mar.onnx` model.
- **OpenCV SFace** produces and compares face embeddings using the `face_recognition_sface_2021dec.onnx` model.
- An in-process **IoU tracker** reuses identities between frames and reduces repeated face-recognition work.
- **OpenCV Headless 4.11**, **NumPy 2.1**, and **Pillow 11.2** support image processing without requiring a desktop GUI.

No NVIDIA GPU, CUDA, cuDNN, `dlib`, or `face-recognition` dependency is required.

## Data and authentication

- **SQLite** stores users and server-side sessions in `backend/data/users.db`, using WAL journaling and foreign keys.
- **JSON** stores local face embeddings in `backend/data/faces.json`.
- Enrollment images are kept on the **local filesystem** under `backend/data/people/<person>/`.
- **Argon2id**, through `pwdlib[argon2]`, hashes passwords.
- Random opaque session tokens are stored server-side as SHA-256 hashes and sent to the browser in HTTP-only, SameSite `strict` cookies.
- Authorization uses the `user` and `admin` roles; administration and face enrollment require the `admin` role.

This persistence model is intentionally local and suits a single application instance. A multi-instance deployment would require shared storage and a shared session/database service.

## Testing

- Frontend tests use **Vitest 3.1**, **Testing Library for React**, **jest-dom**, and **jsdom**.
- Backend tests use **pytest 8.3** and cover the API, authentication, detection, and face-processing behavior.
- The root `npm test` command runs both frontend and backend test suites.

## Deployment and runtime

- The production image uses a **multi-stage Docker build**:
  1. Node.js 22 on Debian Bookworm builds the React application.
  2. Python 3.12 on Debian Bookworm builds a CPU-only virtual environment.
  3. A slim Python runtime serves both the API and static frontend on port `8080`.
- **Docker Compose** supplies environment configuration, restart behavior, localhost-only port publishing, and a named volume for persistent backend data.
- The runtime executes as a non-root `camera` user and includes an HTTP health check.
- Configuration is provided through environment variables for model paths, thresholds, storage locations, authentication, cookies, upload limits, and server settings.

## Primary dependency manifests

- Root development scripts: `package.json`
- Frontend packages: `frontend/package.json` and `frontend/package-lock.json`
- Backend runtime packages: `backend/requirements.txt`
- Backend test packages: `backend/requirements-dev.txt`
- Container build: `docker_camera_detection/Dockerfile`
- Container orchestration: `docker_camera_detection/docker-compose.yml`

