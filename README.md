# Vision Guard

Theo dõi tiến độ và công việc tiếp theo tại
[`docs/WORKLOG.md`](docs/WORKLOG.md).

Vision Guard là ứng dụng giám sát chạy hoàn toàn trên **CPU**, chỉ tập trung vào hai nhiệm vụ:

- phát hiện và xác nhận người bị ngã;
- nhận diện khuôn mặt đã đăng ký.

Các chức năng nhận diện vật thể tùy ý, cử chỉ tay, khói thuốc và buồn ngủ đã được bỏ khỏi pipeline để giảm RAM, thời gian xử lý và số model phải nạp. Ứng dụng vẫn giữ đăng nhập, quản lý người dùng, đăng ký khuôn mặt, nhiều camera và kết nối Home Assistant.

## Cách giảm cảnh báo ngã sai

Backend dùng YOLO Pose nano trên CPU và không kết luận ngã chỉ từ một khung hình. Mỗi người được theo dõi riêng bằng IoU, sau đó kết hợp ba tín hiệu hình học:

- tỷ lệ chiều rộng/chiều cao của khung người;
- góc thân trên giữa vai và hông;
- khoảng cách dọc giữa đầu và hông.

Ít nhất hai tín hiệu phải đồng thuận. Trạng thái chỉ chuyển thành `confirmed` sau `FALL_CONFIRM_FRAMES` khung liên tiếp; trạng thái cảnh báo được xóa sau `FALL_RECOVERY_FRAMES` khung đứng bình thường. Ảnh tải lên không có chuỗi thời gian nên chỉ trả `suspected`, không gửi cảnh báo Home Assistant.

Đây là hệ thống hỗ trợ giám sát, không phải thiết bị y tế. Cần hiệu chỉnh bằng video thật tại đúng vị trí lắp camera trước khi sử dụng để báo động.

## Kiến trúc

- Frontend: React + Vite.
- API: FastAPI.
- Pose/fall: YOLO pose nano, PyTorch CPU.
- Khuôn mặt: OpenCV YuNet + SFace ONNX trên CPU.
- Lưu trữ: JSON cho vector khuôn mặt, SQLite cho tài khoản/session.
- Home Assistant: REST event `vision_guard_fall`.

## Yêu cầu

- Linux 64-bit, Python 3.10–3.12 và Node.js 22+.
- RAM tối thiểu 4 GB, khuyến nghị 8 GB.
- CPU 64-bit nhiều nhân; không cần NVIDIA, CUDA hay cuDNN.
- Internet chỉ cần khi cài thư viện và tải model lần đầu.

## Cài đặt

```bash
cd /home/daikai/Camera-DetectionV2
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install --upgrade pip wheel

# Bắt buộc cài wheel CPU trước Ultralytics
python -m pip install torch torchvision \
  --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r backend/requirements-dev.txt

npm install
npm run install:all
```

Tải các model cần thiết:

```bash
backend/.venv/bin/python backend/download_models.py
backend/.venv/bin/python backend/download_pose_model.py
```

Xác nhận không dùng CUDA:

```bash
backend/.venv/bin/python -c "import torch; print(torch.cuda.is_available())"
```

Kết quả phải là `False`.

## Cấu hình

```bash
cp backend/.env.example backend/.env
chmod 600 backend/.env
```

Các biến chính:

| Biến | Mặc định | Ý nghĩa |
|---|---:|---|
| `POSE_MODEL` | `models/yolo26n-pose.pt` | Model pose nano |
| `POSE_IMAGE_SIZE` | `512` | Kích thước suy luận; giảm xuống 416 nếu CPU yếu |
| `POSE_CONFIDENCE` | `0.45` | Ngưỡng người; tăng nếu có nhiều nhận diện giả |
| `FALL_CONFIRM_SECONDS` | `1.5` | Thời gian nghi ngã liên tục trước khi cảnh báo |
| `FALL_RECOVERY_SECONDS` | `1.0` | Thời gian bình thường liên tục để xóa trạng thái ngã |
| `FALL_MAX_FRAME_GAP_SECONDS` | `1.0` | Khoảng mất dấu tối đa trước khi đặt lại tiến trình xác nhận |
| `FALL_BBOX_RATIO` | `1.15` | Ngưỡng khung người nằm ngang |
| `FALL_TORSO_ANGLE` | `35` | Góc thân tối đa so với phương ngang |
| `FACE_RECOGNITION_INTERVAL` | `8` | Chu kỳ chạy lại SFace cho một track |
| `HA_URL` | trống | URL Home Assistant, ví dụ `http://homeassistant.local:8123` |
| `HA_TOKEN` | trống | Long-Lived Access Token |
| `HA_FALL_EVENT` | `vision_guard_fall` | Tên event gửi vào Home Assistant |
| `HA_ALERT_COOLDOWN_SECONDS` | `60` | Chống gửi cảnh báo lặp |

`INITIAL_ADMIN_PASSWORD` phải có ít nhất 12 ký tự khi khởi tạo database lần đầu.

## Chạy ứng dụng

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8090`
- API docs: `http://localhost:8090/docs`

Để xác nhận ngã theo thời gian, mở camera và dùng **Live scan**. Khi chỉ phân tích một ảnh, backend cố ý không phát cảnh báo khẩn cấp.

## Home Assistant

Khi một track chuyển sang ngã đã xác nhận, backend gọi:

```text
POST /api/events/vision_guard_fall
```

Payload mẫu:

```json
{
  "source": "vision_guard",
  "camera_id": "camera-session-id",
  "track_ids": [3],
  "status": "confirmed"
}
```

Automation mẫu:

```yaml
alias: Vision Guard - cảnh báo ngã
trigger:
  - platform: event
    event_type: vision_guard_fall
action:
  - service: notify.notify
    data:
      title: "Cảnh báo ngã"
      message: "Vision Guard phát hiện một người có thể đã bị ngã."
mode: single
```

Mỗi track chỉ phát event một lần cho đến khi người đó trở lại trạng thái bình thường. Cooldown toàn camera cung cấp thêm một lớp chống lặp.

## API phân tích

`POST /analyze` dùng `multipart/form-data`:

- `image`: ảnh JPEG/PNG;
- `recognize_faces`: bật/tắt nhận diện khuôn mặt;
- `notify_home`: bật/tắt gửi sự kiện Home Assistant;
- `tracking_id`: ID ổn định cho từng camera; bắt buộc để xác nhận theo chuỗi frame.

Các trường trả về quan trọng:

- `poses[].fall.status`: `upright`, `suspected` hoặc `confirmed`;
- `poses[].fall.alert`: chỉ `true` khi đã xác nhận theo thời gian;
- `faces`: khuôn mặt và danh tính;
- `homeControl`: trạng thái gửi event Home Assistant;
- `processingMs`: thời gian xử lý.

## Tối ưu CPU

- Dùng một camera trước, sau đó tăng dần và theo dõi `processingMs`.
- Giữ `POSE_IMAGE_SIZE=512`; CPU yếu có thể dùng 416, đổi lại người ở xa kém chính xác hơn.
- Frontend đã giới hạn frame gửi lên tối đa 960 px và không gửi frame mới khi request trước chưa xong.
- SFace chỉ chạy lại theo chu kỳ và tái sử dụng danh tính qua tracker.
- Không giảm `FALL_CONFIRM_SECONDS` khi chưa đánh giá trên video thực vì dễ tăng cảnh báo sai.
- Đặt camera cao, nhìn chéo, hạn chế che khuất toàn thân và tránh góc quá sát sàn.

## Kiểm thử

```bash
backend/.venv/bin/python -m pytest backend/tests
npm test --prefix frontend -- --run
```
