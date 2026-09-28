# Nhật ký phát triển Vision Guard

Tài liệu này là nguồn theo dõi công việc theo ngày của dự án. Mỗi ngày làm việc
được thêm ở đầu phần **Nhật ký theo ngày**, không xóa lịch sử cũ.

## Trạng thái tổng quan

**Cập nhật gần nhất:** 25/09/2026  
**Giai đoạn:** Prototype chạy được, đang cải thiện độ tin cậy fall detection  
**Môi trường:** CPU-only  
**Phạm vi hiện tại:** phát hiện ngã, nhận diện khuôn mặt và Home Assistant

| Thành phần | Trạng thái | Ghi chú |
|---|---|---|
| YOLO Pose nano trên CPU | Hoạt động | 17 keypoint COCO |
| Luật phát hiện ngã 2/3 tín hiệu | Hoạt động | Chưa được benchmark bằng dataset thực tế |
| Tracking từng người | Cơ bản | IoU, chưa dùng ByteTrack/BoT-SORT |
| Xác nhận ngã nhiều frame | Hoạt động | Phụ thuộc FPS thực tế |
| Nhận diện khuôn mặt | Hoạt động | YuNet + SFace ONNX |
| Camera tự phân tích | Hoạt động | Không còn upload ảnh tại trang Scan |
| Nhiều camera | Hoạt động | Session riêng, sidebar và cấu hình chung |
| Home Assistant | Hoạt động | Event `vision_guard_fall`, có cooldown |
| Đánh giá trên video thực | Chưa thực hiện | Chưa có precision/recall chính thức |
| Lưu video sự kiện | Chưa triển khai | Cần buffer trước/sau cảnh báo |

## Việc cần làm tiếp theo

### P0 — Độ tin cậy của cảnh báo

- [ ] Chuyển xác nhận ngã từ số frame sang thời gian thực bằng timestamp.
- [ ] Sửa vòng đời track khi YOLO không phát hiện người trong một frame.
- [ ] Viết test cho quy tắc 2/3 tín hiệu hình học.
- [ ] Viết test cho `upright → suspected → confirmed → upright`.
- [ ] Viết test cho mất track, tạo track mới và nhiều người giao nhau.
- [ ] Thu video ngã và hard negative tại đúng vị trí camera thực tế.
- [ ] Đo event precision, event recall và false alarms/camera-hour.

### P1 — Giảm cảnh báo sai

- [ ] Lưu lịch sử keypoint 1–3 giây cho từng track.
- [ ] Tính vận tốc dọc của tâm hông.
- [ ] Tính tốc độ thay đổi góc thân và tỷ lệ bounding box.
- [ ] Phân biệt người vừa ngã với người đã nằm sẵn.
- [ ] Kiểm tra bất động trong một khoảng thời gian sau khi nghi ngã.
- [ ] Hỗ trợ vùng sàn và vùng loại trừ giường/sofa theo từng camera.
- [ ] Cho phép bộ ngưỡng riêng theo góc nhìn của từng camera.

### P2 — Tracking và vận hành

- [ ] Đánh giá ByteTrack hoặc BoT-SORT thay cho tracker IoU.
- [ ] Dọn session/tracker theo thời gian sử dụng thay vì xóa session đầu tiên.
- [ ] Thêm health/status khi camera hoặc model ngừng hoạt động.
- [ ] Lưu clip trước và sau sự kiện để người vận hành xác minh.
- [ ] Thêm log có cấu trúc cho track, evidence và Home Assistant event.
- [ ] Thử tải liên tục với 1, 2 và 4 camera; ghi CPU, RAM, FPS và latency.

### P3 — Nghiên cứu sau khi có dữ liệu

- [ ] So sánh YOLO Pose và MediaPipe Pose trên cùng tập video.
- [ ] Xây classifier nhẹ từ chuỗi keypoint.
- [ ] Cân nhắc fine-tune pose nếu lỗi nằm ở chất lượng keypoint.
- [ ] Đánh giá MLP/1D-CNN, LSTM/GRU hoặc TCN khi dữ liệu đủ lớn.

## Vấn đề và rủi ro hiện tại

1. Thuật toán hiện nhận biết tốt hơn trạng thái **nằm ngang** chứ chưa nhận biết
   đầy đủ chuyển động **vừa bị ngã**.
2. `FALL_CONFIRM_FRAMES` phụ thuộc FPS; chạy nhiều camera có thể làm thời gian
   xác nhận dài hơn.
3. Tracker IoU có thể đổi ID khi hai người giao nhau hoặc bị che khuất.
4. Người nằm ngủ, nằm nghỉ, tập thể dục hoặc cúi sâu vẫn có thể tạo cảnh báo sai.
5. Chưa có benchmark trên video thực, nên chưa thể công bố độ chính xác.
6. Chưa lưu clip bằng chứng trước và sau cảnh báo.
7. Hệ thống không phải thiết bị y tế và cần người vận hành xác minh cảnh báo.

## Nhật ký theo ngày

## 25/09/2026

### Mục tiêu

Thu gọn hệ thống thành ứng dụng giám sát CPU-only chỉ gồm phát hiện ngã, nhận
diện khuôn mặt và kết nối Home Assistant.

### Đã hoàn thành

- [x] Loại bỏ YOLO-World/object detection khỏi pipeline.
- [x] Loại bỏ MediaPipe gesture detection.
- [x] Loại bỏ phát hiện buồn ngủ và khói thuốc.
- [x] Xóa dependencies và model MediaPipe không còn dùng.
- [x] Giữ YuNet + SFace cho đăng ký và nhận diện khuôn mặt.
- [x] Thêm YOLO Pose nano chạy bằng `device="cpu"`.
- [x] Chuẩn hóa bounding box và 17 keypoint về tọa độ `0..1`.
- [x] Thêm ba tín hiệu hình học:
  - tỷ lệ rộng/cao của bounding box;
  - góc thân giữa vai và hông;
  - khoảng cách dọc giữa đầu và hông.
- [x] Chỉ đánh dấu nghi ngã khi ít nhất 2/3 tín hiệu đồng thuận.
- [x] Thêm trạng thái `upright`, `suspected` và `confirmed`.
- [x] Thêm tracker IoU và trạng thái riêng cho từng người.
- [x] Thêm xác nhận ngã nhiều frame và hysteresis phục hồi.
- [x] Ảnh/session không có tracking không được phát cảnh báo khẩn cấp.
- [x] Chuyển Home Assistant sang event `vision_guard_fall`.
- [x] Chống gửi event lặp theo track và cooldown theo camera.
- [x] Đổi backend development sang cổng `8090`.
- [x] Bỏ upload ảnh khỏi trang Scan.
- [x] Camera tự bắt đầu phân tích khi stream sẵn sàng.
- [x] Giữ nút dừng/tiếp tục phân tích.
- [x] Gộp sidebar và cấu hình giám sát cho tất cả camera.
- [x] Tổng hợp số người, khuôn mặt và cảnh báo từ tất cả camera.
- [x] Giữ session/tracking riêng cho từng camera.
- [x] Viết tài liệu thuật toán tại
  [`FALL_DETECTION_ALGORITHM.md`](./FALL_DETECTION_ALGORITHM.md).
- [x] Đồng bộ README, `.env.example` và cấu hình Docker.

### Kiểm thử đã thực hiện

- [x] Python compile thành công cho backend.
- [x] Kiểm tra thủ công chuỗi `suspected → confirmed → upright` thành công.
- [x] Frontend: 10/10 test thành công.
- [x] Frontend production build thành công.
- [x] `git diff --check` không phát hiện lỗi whitespace.

### Chưa kiểm thử đầy đủ

- [ ] Chưa chạy toàn bộ pytest backend trong virtualenv đầy đủ dependencies.
- [ ] Chưa benchmark với video ngã thực tế.
- [ ] Chưa thử tải lâu dài với nhiều camera thật.
- [ ] Chưa xác minh event bằng một Home Assistant thật.

### Quyết định kỹ thuật

- Tiếp tục dùng YOLO Pose nano thay vì MediaPipe Pose cho camera nhiều người.
- Ưu tiên giảm cảnh báo sai, chấp nhận có thể bỏ sót một số tư thế khó.
- Không gửi cảnh báo từ một ảnh đơn.
- Không chạy đồng thời YOLO Pose và MediaPipe để tránh tăng tải CPU.
- Cấu hình nhận diện khuôn mặt và Home Assistant được dùng chung cho mọi camera.

### Việc nên bắt đầu trong ngày tiếp theo

1. Viết test đầy đủ cho state machine phát hiện ngã.
2. Sửa track không được cập nhật khi frame không có pose.
3. Chuyển `FALL_CONFIRM_FRAMES` thành `FALL_CONFIRM_SECONDS`.
4. Thêm log evidence theo camera và track để chuẩn bị thu dữ liệu.

## Mẫu ghi nhật ký cho ngày mới

Sao chép phần dưới đây và đặt ngay phía trên ngày cũ nhất:

```markdown
## DD/MM/YYYY

### Mục tiêu

Mô tả mục tiêu chính trong ngày.

### Đã hoàn thành

- [x] Công việc đã hoàn thành.

### Đang thực hiện

- [ ] Công việc đang thực hiện và trạng thái hiện tại.

### Kiểm thử

- [x] Test/build/benchmark đã chạy và kết quả.

### Vấn đề phát hiện

- Mô tả lỗi, giới hạn hoặc rủi ro mới.

### Việc tiếp theo

1. Công việc ưu tiên cao nhất.
2. Công việc tiếp theo.
```

## Quy ước cập nhật

- Mỗi thay đổi đáng kể phải được ghi trong ngày thực hiện.
- Ghi rõ test nào đã chạy; không ghi “đã kiểm thử” nếu chưa có kết quả.
- Công việc chưa hoàn thành dùng `- [ ]`; hoàn thành dùng `- [x]`.
- Nếu thay đổi quyết định kỹ thuật, ghi lý do và ảnh hưởng.
- Khi hoàn thành một mục P0/P1/P2/P3, đánh dấu tại danh sách tổng phía trên.
- Không xóa vấn đề cũ; ghi ngày đã giải quyết và liên kết tới mục tương ứng.

