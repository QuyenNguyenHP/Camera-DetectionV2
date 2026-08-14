# Vision Guard

Ứng dụng nhận diện người, khuôn mặt và vật thể gồm:

- **Frontend:** React, JavaScript và Vite.
- **Backend:** Python và FastAPI.
- **Nhận diện vật thể:** YOLO-World (`yolov8s-worldv2.pt`).
- **Phát hiện khuôn mặt:** OpenCV YuNet chạy bằng ONNX trên CPU.
- **Nhận diện khuôn mặt:** OpenCV SFace chạy bằng ONNX trên CPU.
- **Theo dõi khuôn mặt:** tracker IoU tái sử dụng danh tính giữa các frame.
- **Dữ liệu khuôn mặt:** lưu vector cục bộ dưới dạng JSON và ảnh đăng ký trong thư mục riêng.

> **Lưu ý quan trọng:** dự án này chạy hoàn toàn bằng **CPU**, không sử dụng GPU
> NVIDIA, CUDA hoặc cuDNN. Tốc độ phân tích trực tiếp sẽ phụ thuộc vào CPU và có
> thể chậm hơn đáng kể so với máy có GPU.

## 1. Chức năng

- Phát hiện người và các vật thể được nhập bằng văn bản với YOLO-World.
- Tải ảnh lên hoặc lấy hình ảnh trực tiếp từ webcam.
- Liệt kê và chuyển đổi giữa nhiều camera trên cùng thiết bị.
- Phân tích một khung hình hoặc quét liên tục.
- Đăng ký khuôn mặt mới trên trang Identity Enrollment riêng.
- Trang Login là điểm vào mặc định; người dùng phải đăng nhập trước khi Scan.
- Phân quyền `user` và `admin`; chỉ admin được đăng ký khuôn mặt và tạo tài khoản.
- So khớp khuôn mặt với dữ liệu đã đăng ký.
- Trả kết quả từ backend dưới dạng JSON và vẽ khung nhận diện trên frontend.
- Lưu vector khuôn mặt trong `backend/data/faces.json` và ảnh đăng ký trong
  `backend/data/people/<tên người>/`.
- Lưu tài khoản và session trong SQLite `backend/data/users.db`; mật khẩu được
  băm bằng Argon2id và không lưu dạng nguyên bản.

## 2. Cấu trúc dự án

```text
Camera-Detection/
├── frontend/
│   ├── src/
│   │   ├── main.jsx         Entry point và điều hướng giữa Scan/Enrollment
│   │   ├── pages/           Logic cho trang Login, Scan và Enrollment
│   │   ├── components/      Header, navigator, camera box, footer và sidebar
│   │   ├── utils/           Tiện ích camera dùng chung
│   │   ├── api.js           Gọi trực tiếp FastAPI
│   │   └── styles.css
│   ├── package.json
│   └── .env.example
├── backend/
│   ├── app.py               Khởi chạy bằng python3 app.py
│   ├── vision_app/
│   │   ├── main.py          API FastAPI
│   │   ├── auth.py          SQLite users, Argon2id và server-side sessions
│   │   ├── detector.py      YOLO-World
│   │   ├── faces.py         Đăng ký và nhận diện khuôn mặt
│   │   ├── image_utils.py   Đọc và kiểm tra ảnh
│   │   └── config.py        Cấu hình từ biến môi trường
│   ├── models/              Model YuNet và SFace ONNX
│   ├── download_models.py   Tải model chính thức từ OpenCV Zoo
│   ├── data/                Nơi lưu faces.json và ảnh people/<tên người>/
│   ├── tests/
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── .env.example
├── package.json             Lệnh chạy toàn bộ dự án
└── README.md
```

Trong chế độ development, frontend gọi trực tiếp backend tại
`http://localhost:8000`. Không có Node API gateway. Hướng dẫn Docker portable
nằm trong `docker_camera_detection/README.md`.

## 3. Yêu cầu hệ thống

Khuyến nghị:

- Ubuntu/Debian 64-bit hoặc hệ điều hành Linux tương đương.
- Python 3.10–3.12; Python 3.11 được khuyến nghị.
- Node.js 22 trở lên và npm.
- RAM tối thiểu 4 GB; khuyến nghị 8 GB trở lên.
- Khoảng 3 GB dung lượng trống cho thư viện Python và model.
- CPU hỗ trợ 64-bit; CPU nhiều nhân sẽ cho tốc độ tốt hơn.
- Webcam là tùy chọn nếu chỉ phân tích ảnh tải lên.
- Có Internet trong lần cài đặt và lần tải model đầu tiên.

Kiểm tra phiên bản đang có:

```bash
python3 --version
node --version
npm --version
```

## 4. Cài thư viện hệ thống trên Ubuntu/Debian

Backend dùng OpenCV ONNX nên không cần biên dịch `dlib`. Cài các gói Python,
Git và thư viện runtime OpenCV:

```bash
sudo apt update
sudo apt install -y \
  python3 \
  python3-venv \
  python3-dev \
  python3-pip \
  git \
  libgl1 \
  libglib2.0-0
```

Nếu chưa có Node.js, hãy cài một phiên bản LTS còn được hỗ trợ từ trang chính
thức của Node.js. Sau khi cài, xác nhận `node --version` và `npm --version` hoạt
động trước khi tiếp tục.

## 5. Cài frontend

Tại thư mục gốc của dự án:

```bash
cd /home/dq/Camera-Detection

# Cài concurrently dùng để chạy frontend và backend cùng lúc
npm install

# Cài React, Vite và các thư viện frontend
npm run install:all
```

Lệnh tương đương nếu chỉ muốn cài frontend:

```bash
npm install --prefix frontend
```

## 6. Cài backend chạy CPU, không dùng NVIDIA

### 6.1. Tạo môi trường Python riêng

```bash
cd /home/dq/Camera-Detection
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install --upgrade pip wheel
```

Khi môi trường được kích hoạt, đầu dòng lệnh thường xuất hiện `(.venv)`.

### 6.2. Cài PyTorch bản CPU

Phải cài PyTorch bản CPU trước khi cài Ultralytics:

```bash
python -m pip install torch torchvision \
  --index-url https://download.pytorch.org/whl/cpu
```

Lệnh trên dùng kho wheel CPU chính thức của PyTorch, không cài CUDA và không yêu
cầu card NVIDIA.

### 6.3. Cài FastAPI, YOLO-World và nhận diện khuôn mặt

```bash
python -m pip install -r backend/requirements-dev.txt
```

Lệnh này cài OpenCV, FastAPI và Ultralytics CLIP. Không còn cài `dlib`,
`face-recognition`, `face-recognition-models` hoặc phiên bản Setuptools cũ.

### 6.4. Kiểm tra các thư viện

```bash
python -c "import torch; print('PyTorch:', torch.__version__); print('CUDA:', torch.cuda.is_available())"
python -c "import fastapi, cv2, ultralytics; print('YuNet:', hasattr(cv2, 'FaceDetectorYN')); print('SFace:', hasattr(cv2, 'FaceRecognizerSF'))"
```

Kết quả đúng cho dự án này phải có:

```text
CUDA: False
YuNet: True
SFace: True
```

Nếu `CUDA` là `True`, hãy gỡ PyTorch hiện tại rồi cài lại bản CPU:

```bash
python -m pip uninstall -y torch torchvision torchaudio
python -m pip install torch torchvision \
  --index-url https://download.pytorch.org/whl/cpu
```

## 7. Cấu hình backend

Tạo file cấu hình từ file mẫu:

```bash
cd /home/dq/Camera-Detection
cp backend/.env.example backend/.env
chmod 600 backend/.env
```

Mở `backend/.env` và đặt mật khẩu mạnh cho admin đầu tiên. Không đặt mật khẩu
thật trong `.env.example` và không commit file `.env`:

```env
YOLO_MODEL=yolov8s-worldv2.pt
YOLO_DEVICE=cpu
DETECTION_CONFIDENCE=0.30
FACE_STORE=data/faces.json
FACE_PHOTO_DIR=data/people
YUNET_MODEL=models/face_detection_yunet_2023mar.onnx
SFACE_MODEL=models/face_recognition_sface_2021dec.onnx
YUNET_SCORE_THRESHOLD=0.80
FACE_SIMILARITY_THRESHOLD=0.40
FACE_RECOGNITION_INTERVAL=8
TRACK_IOU_THRESHOLD=0.25
TRACK_MAX_MISSED=3
MAX_UPLOAD_BYTES=10485760
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
BACKEND_RELOAD=true
AUTH_DATABASE=data/users.db
AUTH_SESSION_HOURS=12
AUTH_COOKIE_NAME=camera_session
AUTH_COOKIE_SECURE=false
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=MAT_KHAU_MANH_TOI_THIEU_12_KY_TU
```

`AUTH_COOKIE_SECURE=false` chỉ dành cho development bằng
`http://localhost`. Khi triển khai qua domain/HTTPS, phải đổi thành `true`.
Admin ban đầu chỉ được tạo khi database chưa có tài khoản. Sau lần tạo đầu tiên,
đổi `INITIAL_ADMIN_PASSWORD` không đổi mật khẩu trong database.

| Biến | Ý nghĩa |
|---|---|
| `YOLO_MODEL` | Tên hoặc đường dẫn đến file model YOLO-World |
| `DETECTION_CONFIDENCE` | Ngưỡng tin cậy tối thiểu của vật thể |
| `FACE_STORE` | File JSON lưu vector khuôn mặt |
| `FACE_PHOTO_DIR` | Thư mục lưu ảnh đăng ký, phân theo tên người |
| `YUNET_MODEL` | Đường dẫn model ONNX phát hiện khuôn mặt |
| `SFACE_MODEL` | Đường dẫn model ONNX tạo embedding khuôn mặt |
| `YUNET_SCORE_THRESHOLD` | Ngưỡng tin cậy phát hiện khuôn mặt |
| `FACE_SIMILARITY_THRESHOLD` | Ngưỡng cosine nhận diện; cao hơn nghiêm ngặt hơn |
| `FACE_RECOGNITION_INTERVAL` | Số frame tracker chờ trước khi chạy lại SFace |
| `TRACK_IOU_THRESHOLD` | IoU tối thiểu để nối khuôn mặt với track cũ |
| `TRACK_MAX_MISSED` | Số frame mất dấu trước khi xóa track |
| `MAX_UPLOAD_BYTES` | Kích thước ảnh tải lên tối đa, mặc định 10 MB |
| `BACKEND_HOST` | Địa chỉ backend lắng nghe, mặc định chỉ trên máy hiện tại |
| `BACKEND_PORT` | Cổng backend, mặc định `8000` |
| `BACKEND_RELOAD` | Tự khởi động lại khi sửa code trong môi trường phát triển |
| `AUTH_DATABASE` | SQLite lưu tài khoản và session, mặc định `data/users.db` |
| `AUTH_SESSION_HOURS` | Thời hạn đăng nhập, mặc định 12 giờ |
| `AUTH_COOKIE_NAME` | Tên session cookie; development dùng `camera_session` |
| `AUTH_COOKIE_SECURE` | `false` cho localhost HTTP; `true` cho production HTTPS |
| `INITIAL_ADMIN_USERNAME` | Tên admin được tạo khi database còn trống |
| `INITIAL_ADMIN_PASSWORD` | Mật khẩu admin đầu tiên, tối thiểu 12 ký tự |

## 8. Tải các model

### 8.1. YuNet và SFace

Hai model ONNX phải tồn tại trước khi nhận diện khuôn mặt. Tải từ OpenCV Zoo:

```bash
cd /home/dq/Camera-Detection/backend
.venv/bin/python download_models.py
```

Kết quả:

```text
backend/models/face_detection_yunet_2023mar.onnx
backend/models/face_recognition_sface_2021dec.onnx
```

### 8.2. YOLO-World

Backend sử dụng model:

```text
yolov8s-worldv2.pt
```

Không bắt buộc tải thủ công. Trong lần phân tích ảnh đầu tiên, Ultralytics sẽ tự
tải model nếu file chưa tồn tại. Muốn tải trước, chạy:

```bash
cd /home/dq/Camera-Detection/backend
source .venv/bin/activate
python -c "from ultralytics import YOLOWorld; YOLOWorld('yolov8s-worldv2.pt'); print('Model ready')"
```

Sau khi hoàn thành, file thường nằm tại:

```text
backend/yolov8s-worldv2.pt
```

Sau khi model đã được tải, chức năng nhận diện có thể chạy mà không cần Internet.

## 9. Chạy backend và frontend riêng biệt

### Terminal 1 — Backend

```bash
cd /home/dq/Camera-Detection/backend
python3 app.py
```

`app.py` tự chuyển sang Python trong `backend/.venv`, nên không bắt buộc chạy
`source .venv/bin/activate` trước. Backend đọc cấu hình từ `backend/.env`.

Địa chỉ backend:

- Kiểm tra trạng thái: <http://localhost:8000/health>
- Tài liệu API Swagger: <http://localhost:8000/docs>

Kết quả `/health` khi backend hoạt động:

```json
{
  "status": "ok",
  "modelLoaded": false
}
```

`modelLoaded: false` trước lần phân tích đầu tiên là bình thường.

### Terminal 2 — Frontend

Tạo file môi trường frontend trong lần đầu:

```bash
cd /home/dq/Camera-Detection
cp frontend/.env.example frontend/.env
```

Nội dung phải là:

```env
VITE_API_URL=http://localhost:8000
```

Sau đó chạy:

```bash
cd /home/dq/Camera-Detection/frontend
npm ci
npm run dev
```

Mở trình duyệt tại:

```text
http://localhost:5173
```

Trang Login sẽ xuất hiện trước. Đăng nhập bằng:

```text
Username: admin
Password: giá trị INITIAL_ADMIN_PASSWORD trong backend/.env
```

Sau khi đăng nhập bằng admin, mở **Identity enrollment → User management** để
tạo tài khoản `user` hoặc `admin`. Tài khoản `user` chỉ được Scan; tài khoản
`admin` được Scan, đăng ký khuôn mặt và tạo người dùng mới.

Trình duyệt sẽ yêu cầu quyền sử dụng camera. Nếu không cấp quyền, chức năng tải
ảnh lên vẫn hoạt động. Sau khi cấp quyền và mở camera lần đầu, dùng danh sách
**Camera mặc định** bên dưới khung hình để chọn webcam khác. Tên thiết bị chỉ có
thể xuất hiện sau khi trình duyệt đã được cấp quyền camera.

## 10. Chạy toàn bộ dự án bằng một lệnh

Sau khi đã tạo `backend/.env`, `frontend/.env` và cài dependencies, chạy từ thư
mục gốc:

```bash
cd /home/dq/Camera-Detection
npm run dev
```

Lệnh này chạy đồng thời:

- Frontend tại `http://localhost:5173`.
- Backend tại `http://localhost:8000`.

Dừng cả hai bằng `Ctrl+C`.

## 11. Chạy trên máy khác trong cùng mạng LAN

Không dùng Vite development server và HTTP thô để triển khai cho máy khác.
Trình duyệt chỉ cho phép camera trên `localhost` hoặc HTTPS; đồng thời production
phải dùng session cookie `Secure`.

### Build và chạy bằng Docker Compose

Sau mỗi lần cập nhật hoặc chỉnh sửa source code, chạy:

```bash
cd /home/dq/Camera-Detection/docker_camera_detection
docker compose up -d --build
```

Lệnh này tự build image `camera-detection:1.1.0-cpu`, sau đó tạo lại và chạy
container ở chế độ nền. Không cần chạy riêng `docker build`.

Nếu đang đứng tại thư mục gốc của dự án, dùng lệnh tương đương:

```bash
docker compose -f docker_camera_detection/docker-compose.yml up -d --build
```

Kiểm tra trạng thái và log:

```bash
cd /home/dq/Camera-Detection/docker_camera_detection
docker compose ps
docker compose logs -f camera-detection
```

Dữ liệu tài khoản và khuôn mặt nằm trong volume `camera-detection-data`, vì vậy
vẫn được giữ lại khi container được build lại. Không thêm tùy chọn `-v` vào lệnh
`docker compose down` trừ khi muốn xóa toàn bộ dữ liệu này.

Để truy cập từ PC khác, đặt Caddy hoặc Apache2 HTTPS phía trước container. Xem
hướng dẫn triển khai và xuất image sang máy khác tại:

```text
docker_camera_detection/README.md
```

Không public trực tiếp cổng backend `8000` hoặc container `8080`.

## 12. API backend

| Phương thức | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/health` | Kiểm tra backend và trạng thái model |
| `GET` | `/auth/status` | Kiểm tra hệ thống đã có admin hay chưa |
| `POST` | `/auth/login` | Đăng nhập và nhận session cookie `HttpOnly` |
| `POST` | `/auth/logout` | Xóa session hiện tại |
| `GET` | `/auth/me` | Thông tin tài khoản đang đăng nhập |
| `GET` | `/users` | Danh sách tài khoản — chỉ admin |
| `POST` | `/users` | Tạo tài khoản `user/admin` — chỉ admin |
| `GET` | `/faces` | Danh sách tên đã đăng ký — chỉ admin |
| `POST` | `/analyze` | Phân tích ảnh — mọi tài khoản đã đăng nhập |
| `POST` | `/faces/enroll` | Đăng ký khuôn mặt — chỉ admin |

Ngoại trừ `/health`, `/auth/status` và `/auth/login`, API yêu cầu session cookie.
Ví dụ đăng nhập bằng `curl` và lưu cookie tạm thời:

```bash
curl -c /tmp/camera-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"MAT_KHAU_ADMIN"}' \
  http://localhost:8000/auth/login
```

`POST /analyze` sử dụng `multipart/form-data`:

- `image`: file ảnh.
- `classes`: danh sách vật thể, phân tách bằng dấu phẩy.
- `recognize_faces`: `true` hoặc `false`.
- `tracking_id`: mã phiên camera; bỏ trống đối với ảnh upload.

Ví dụ:

```bash
curl -b /tmp/camera-cookies.txt \
  -X POST http://localhost:8000/analyze \
  -F "image=@/duong-dan/anh.jpg" \
  -F "classes=person,car,backpack,cell phone" \
  -F "recognize_faces=true"
```

## 13. Chạy kiểm thử

```bash
cd /home/dq/Camera-Detection
source backend/.venv/bin/activate
npm test
```

Hoặc chạy riêng:

```bash
npm --prefix frontend test
```

```bash
cd /home/dq/Camera-Detection/backend
source .venv/bin/activate
python -m pytest
```

Các bài kiểm thử backend không tải model YOLO. Chỉ khi phân tích ảnh thật thì
model mới được nạp.

## 14. Xử lý lỗi thường gặp

### Login báo chưa có administrator

Kiểm tra `backend/.env` có mật khẩu admin tối thiểu 12 ký tự:

```env
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=MAT_KHAU_MANH_TOI_THIEU_12_KY_TU
```

Dừng hoàn toàn backend bằng `Ctrl+C`, sau đó chạy lại:

```bash
cd /home/dq/Camera-Detection/backend
python3 app.py
```

Kiểm tra trạng thái:

```bash
curl http://localhost:8000/auth/status
```

Nếu trả về `{"setupRequired":false}`, admin đã được tạo. Database development
nằm tại `backend/data/users.db`.

### Đăng nhập đúng nhưng lại quay về Login

Khi dùng `http://localhost:5173`, kiểm tra:

```env
AUTH_COOKIE_NAME=camera_session
AUTH_COOKIE_SECURE=false
```

Frontend phải được mở đúng bằng `http://localhost:5173`, và `frontend/.env` phải
trỏ tới `http://localhost:8000`. Sau khi thay `.env`, khởi động lại cả backend và
Vite. Production qua HTTPS phải đổi `AUTH_COOKIE_SECURE=true`.

### `node: command not found`

Cài Node.js LTS, sau đó mở terminal mới và kiểm tra:

```bash
node --version
npm --version
```

### `ModuleNotFoundError`

Môi trường Python chưa được kích hoạt hoặc chưa cài requirements:

```bash
cd /home/dq/Camera-Detection
source backend/.venv/bin/activate
python -m pip install -r backend/requirements-dev.txt
```

### `externally-managed-environment` hoặc lỗi PEP 668

Lỗi này xảy ra khi `pip` đang cố cài package vào Python hệ thống thay vì
`backend/.venv`. Không sử dụng `sudo pip` và không thêm
`--break-system-packages`.

Cài lại đúng vào môi trường riêng:

```bash
cd /home/dq/Camera-Detection
sudo apt install -y python3-venv python3-full git
python3 -m venv backend/.venv

backend/.venv/bin/python -m pip install --upgrade pip wheel
backend/.venv/bin/python -m pip install torch torchvision \
  --index-url https://download.pytorch.org/whl/cpu
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
```

Sau đó chạy:

```bash
cd /home/dq/Camera-Detection/backend
python3 app.py
```

`backend/app.py` sẽ tự chuyển sang Python trong `.venv` nếu bạn quên kích hoạt
môi trường.

### YOLO-World báo thiếu Ultralytics CLIP

Đảm bảo máy có `git`, sau đó cài CLIP bằng chính Python trong `.venv`:

```bash
sudo apt install -y git
cd /home/dq/Camera-Detection
backend/.venv/bin/python -m pip install \
  "git+https://github.com/ultralytics/CLIP.git"
```

Kiểm tra:

```bash
backend/.venv/bin/python -c "import clip; print('Ultralytics CLIP: OK')"
```

### Thiếu model YuNet hoặc SFace

Nếu API báo `Thiếu model ONNX`, chạy:

```bash
cd /home/dq/Camera-Detection/backend
.venv/bin/python download_models.py
```

Hai file phải có kích thước khoảng 228 KB và 37 MB; file vài byte thường chỉ là
Git LFS pointer và không phải model thật.

### Lần nhận diện đầu tiên rất chậm

Đây là hành vi bình thường vì model YOLO-World được tải và nạp vào RAM lần đầu.
Các lần sau sẽ nhanh hơn. Vì dự án chạy CPU, mỗi khung hình có thể cần nhiều thời
gian hơn máy dùng GPU.

### Không mở được camera

- Cho phép quyền camera trong trình duyệt.
- Khi phát triển, sử dụng `http://localhost:5173`.
- Khi truy cập qua mạng hoặc triển khai thật, sử dụng HTTPS.
- Đóng các ứng dụng khác đang chiếm webcam.

### Frontend báo backend không khả dụng

Kiểm tra:

```bash
curl http://localhost:8000/health
```

Nếu lệnh không trả JSON, hãy khởi động lại backend và xem lỗi trong Terminal 1.

## 15. Dữ liệu khuôn mặt và quyền riêng tư

Nhận diện khuôn mặt là xử lý dữ liệu sinh trắc học. Chỉ đăng ký người đã đồng ý,
giới hạn quyền truy cập API, quy định thời gian lưu dữ liệu và tuân thủ pháp luật
tại nơi triển khai.

Ứng dụng đã có đăng nhập, Argon2id, session cookie và phân quyền `user/admin`.
Trước khi thương mại hóa vẫn cần HTTPS, mã hóa/sao lưu dữ liệu, giới hạn tần
suất đăng nhập và phân tích, nhật ký truy cập, đổi/reset mật khẩu, vô hiệu hóa tài
khoản và API xóa đăng ký. Không sử dụng kết quả nhận diện làm căn cứ duy nhất cho
quyết định có ảnh hưởng lớn đến con người.

## Tài liệu chính thức

- [Cài đặt PyTorch và lựa chọn nền tảng CPU](https://pytorch.org/get-started/locally/)
- [Hướng dẫn cài đặt Ultralytics](https://docs.ultralytics.com/quickstart/)
- [Tài liệu YOLO-World](https://docs.ultralytics.com/models/yolo-world/)
- [Tải Node.js](https://nodejs.org/en/download)
