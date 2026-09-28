# Thuật toán phát hiện người bị ngã

Tài liệu này mô tả thuật toán đang được triển khai trong
`backend/vision_app/poses.py`, các giới hạn đã biết và hướng cải thiện độ chính
xác trong tương lai.

> Hệ thống chỉ hỗ trợ giám sát và không phải thiết bị y tế. Mọi phiên bản dùng
> trong thực tế phải được đánh giá bằng video thu tại đúng vị trí lắp camera.

## 1. Mục tiêu thiết kế

Thuật toán được thiết kế theo các ưu tiên sau:

1. Chạy hoàn toàn trên CPU.
2. Nhận diện được nhiều người trong cùng khung hình.
3. Hạn chế cảnh báo sai do ngồi, cúi người hoặc nằm sẵn.
4. Không phát cảnh báo khẩn cấp chỉ dựa trên một ảnh đơn.
5. Theo dõi độc lập trạng thái của từng người.
6. Gửi một sự kiện Home Assistant khi một ca ngã mới được xác nhận.

## 2. Luồng xử lý tổng thể

```text
Khung hình camera
        │
        ▼
YOLO Pose nano trên CPU
        │
        ├── bounding box của từng người
        └── 17 keypoint COCO + confidence
        │
        ▼
Chuẩn hóa tọa độ về khoảng 0..1
        │
        ▼
Ghép người với track cũ bằng IoU
        │
        ▼
Tính ba tín hiệu hình học
        │
        ▼
Ít nhất 2/3 tín hiệu đồng thuận?
        │
        ├── Không: upright
        └── Có: suspected
                    │
                    ▼
       Đủ số frame liên tiếp?
                    │
                    ├── Không: tiếp tục theo dõi
                    └── Có: confirmed + alert
                                   │
                                   ▼
                       Event Home Assistant
```

## 3. Ước lượng pose

Model mặc định là `yolo26n-pose.pt`. Lệnh suy luận hiện tại tương đương:

```python
model.predict(
    image,
    device="cpu",
    imgsz=512,
    conf=0.45,
    verbose=False,
)
```

Mỗi người có:

- bounding box `(x, y, width, height)`;
- độ tin cậy phát hiện người;
- 17 keypoint theo định dạng COCO;
- confidence riêng cho từng keypoint.

Tất cả tọa độ được chia cho chiều rộng hoặc chiều cao ảnh để đưa về khoảng
`0..1`. Nhờ vậy, các phép đo không phụ thuộc trực tiếp vào độ phân giải camera.

Keypoint chỉ được dùng để tính hình học khi có confidence từ `0.45` trở lên.
Nếu chỉ thấy một bên cơ thể, tâm vai hoặc tâm hông được tính từ keypoint còn
nhìn thấy. Nếu thấy cả hai bên, tọa độ trung bình được sử dụng.

## 4. Theo dõi từng người

Thuật toán dùng Intersection over Union (IoU) giữa bounding box hiện tại và
bounding box của frame trước:

```text
IoU = diện tích giao / diện tích hợp
```

Pose được nối với track có IoU lớn nhất. Nếu IoU nhỏ hơn `0.25`, một track mới
được tạo. Một track biến mất quá 5 frame sẽ bị xóa.

Trạng thái lưu cho mỗi track:

```text
box             bounding box gần nhất
    suspected_since thời điểm bắt đầu nghi ngã liên tục
    upright_since   thời điểm bắt đầu bình thường liên tục
    last_seen_at    thời điểm gần nhất nhìn thấy track
confirmed       ngã đã được xác nhận hay chưa
missed          số frame mất dấu
```

`tracking_id` phải ổn định cho từng camera. Nếu frontend không gửi
`tracking_id`, backend không có lịch sử thời gian và sẽ không đặt `alert=true`.

### Giới hạn của tracker IoU

- Hai người đi cắt qua nhau có thể bị đổi track.
- Camera rung hoặc người di chuyển nhanh làm IoU giảm mạnh.
- Người bị che khuất lâu hơn 5 frame sẽ nhận track mới khi xuất hiện lại.
- IoU không dùng ngoại hình hoặc keypoint để phân biệt hai người gần nhau.

## 5. Ba tín hiệu hình học

### 5.1. Tỷ lệ bounding box

```text
aspect_ratio = box_width / box_height
```

Tín hiệu được bật khi:

```text
aspect_ratio >= FALL_BBOX_RATIO
```

Giá trị mặc định là `1.15`. Một người nằm thường tạo bounding box rộng hơn
cao. Tín hiệu này đơn giản và rẻ, nhưng có thể sai khi người cúi sâu, ngồi trên
ghế dài hoặc chỉ hiện một phần trong ảnh.

### 5.2. Góc thân người

Thuật toán tính tâm vai và tâm hông:

```text
shoulder_center = mean(left_shoulder, right_shoulder)
hip_center      = mean(left_hip, right_hip)
```

Sau đó tính góc của vector từ vai đến hông so với phương ngang:

```text
torso_angle = abs(atan2(hip_y - shoulder_y, hip_x - shoulder_x))
```

Góc được đưa về khoảng `0..90` độ:

- gần `0°`: thân gần nằm ngang;
- gần `90°`: thân gần thẳng đứng.

Tín hiệu được bật khi:

```text
torso_angle <= FALL_TORSO_ANGLE
```

Mặc định là `35°`.

### 5.3. Khoảng cách dọc giữa đầu và hông

Tâm đầu được lấy từ các điểm mũi, mắt và tai đủ confidence. Thuật toán tính:

```text
head_hip_delta = abs(head_y - hip_y)
```

Tín hiệu được bật khi:

```text
head_hip_delta <= max(box_height * 0.35, 0.04)
```

Khi người nằm ngang, đầu và hông thường có tung độ gần nhau. Ngưỡng tối thiểu
`0.04` giúp tránh giá trị quá nhỏ khi bounding box nhỏ.

## 6. Quy tắc quyết định

Một pose chỉ được đánh dấu `suspected` khi:

1. tính được ít nhất hai tín hiệu; và
2. ít nhất hai tín hiệu trả về đúng.

Nói cách khác, một đặc điểm đơn lẻ không đủ để kết luận. Đây là lựa chọn có chủ
đích để ưu tiên giảm cảnh báo sai.

Các trạng thái trả về:

| Trạng thái | Ý nghĩa | `alert` |
|---|---|---:|
| `upright` | Chưa đủ bằng chứng ngã | `false` |
| `suspected` | Hình học giống tư thế ngã nhưng chưa đủ thời gian | `false` |
| `confirmed` | Đủ số frame nghi ngã liên tiếp | `true` |

## 7. Xác nhận theo thời gian và hysteresis

Khi một track liên tục có hình học nghi ngã, backend lưu thời điểm bắt đầu:

```text
suspected_since = monotonic()
upright_since = None
```

Track chỉ chuyển sang `confirmed` khi:

```text
monotonic() - suspected_since >= FALL_CONFIRM_SECONDS
```

Mặc định `FALL_CONFIRM_SECONDS=1.5`.

Khi pose trở lại bình thường:

```text
upright_since = monotonic()
suspected_since = None
```

Trạng thái `confirmed` chỉ được xóa khi:

```text
monotonic() - upright_since >= FALL_RECOVERY_SECONDS
```

Mặc định `FALL_RECOVERY_SECONDS=1.0`. Việc dùng ngưỡng xác nhận và ngưỡng phục hồi
khác nhau là hysteresis, giúp trạng thái không nhấp nháy khi kết quả dao động
quanh ngưỡng.

Nếu khoảng cách giữa hai lần nhìn thấy track vượt
`FALL_MAX_FRAME_GAP_SECONDS=1.0`, tiến trình xác nhận và trạng thái cũ được đặt
lại. Điều này ngăn hệ thống cộng thời gian trong lúc camera mất người. Đồng hồ
`monotonic()` được dùng để không bị ảnh hưởng khi giờ hệ thống thay đổi.

## 8. Cảnh báo Home Assistant

Chỉ pose có `fall.alert=true` và có `trackId` mới có thể tạo cảnh báo. Backend
gửi event:

```text
vision_guard_fall
```

Mỗi track chỉ gửi một lần khi chuyển sang ngã đã xác nhận. Track được phép gửi
lại sau khi đã phục hồi rồi ngã lần nữa. Ngoài ra còn có cooldown toàn camera,
mặc định 60 giây, để ngăn nhiều cảnh báo liên tiếp.

## 9. Các trường hợp dễ sai

### Dương tính giả

- Người nằm ngủ hoặc nằm nghỉ từ trước.
- Ngồi/khom sâu trên sofa hay ghế thấp.
- Buộc dây giày, nhặt đồ hoặc tập thể dục sát sàn.
- Camera nghiêng khiến người đứng có thân gần phương ngang trong ảnh.
- Bounding box bị cắt bởi mép ảnh.
- Chỉ nhìn thấy nửa thân trên.
- Hai người chồng lấn tạo bounding box hoặc keypoint không ổn định.

### Âm tính giả

- Người ngã theo hướng thẳng về phía camera.
- Người bị bàn, giường hoặc đồ vật che khuất.
- Người quá nhỏ hoặc hình ảnh thiếu sáng, nhòe chuyển động.
- Người ngã nhưng vẫn có bounding box cao hơn rộng.
- Track bị mất đúng lúc chuyển trạng thái.

## 10. Hướng cải thiện theo thứ tự ưu tiên

### Giai đoạn 1 — Xác nhận theo thời gian thực (đã hoàn thành)

Thay `fall_frames` bằng timestamp:

```text
suspected_since
confirmed_at
upright_since
```

Hệ thống hiện xác nhận theo số giây và đặt lại tiến trình khi khoảng trống giữa
hai frame vượt ngưỡng. Kết quả vì vậy ổn định hơn khi số camera hoặc tải CPU làm
FPS thay đổi.

### Giai đoạn 2 — Nhận biết chuyển động ngã

Một ca ngã thường có quá trình chuyển trạng thái:

```text
đứng/ngồi → hạ thấp nhanh → nằm → bất động
```

Cần lưu cửa sổ 1–3 giây cho mỗi track và bổ sung:

- vận tốc dọc của tâm hông;
- tốc độ thay đổi góc thân;
- tốc độ thay đổi tỷ lệ bounding box;
- độ cao của hông so với vùng sàn;
- thời gian bất động sau khi tiếp đất.

Điều này giúp phân biệt “đang nằm sẵn” với “vừa bị ngã”.

### Giai đoạn 3 — Vùng sàn và vùng loại trừ

Với camera cố định, cho phép cấu hình:

- polygon vùng sàn;
- vùng giường, sofa và ghế;
- vùng cửa hoặc khu vực thường bị che khuất.

Chỉ xác nhận ngã khi thân/hông nằm trong vùng sàn hợp lệ. Pose nằm trong vùng
giường có thể được gắn trạng thái `lying_safe` thay vì `confirmed`.

### Giai đoạn 4 — Tracker tốt hơn

Thay tracker IoU bằng ByteTrack hoặc BoT-SORT, kết hợp:

- vị trí và vận tốc bounding box;
- độ tương đồng keypoint;
- tùy chọn đặc trưng ngoại hình.

Mục tiêu là giảm đổi ID khi nhiều người giao nhau và giữ track qua che khuất
ngắn hạn.

### Giai đoạn 5 — Chuẩn hóa theo góc camera

Ba tín hiệu hiện tại được đo trong mặt phẳng ảnh nên nhạy với góc lắp camera.
Có thể cải thiện bằng:

- hiệu chỉnh camera và homography mặt sàn;
- đo khoảng cách trong tọa độ mặt sàn;
- dùng keypoint 3D/world landmarks;
- đặt bộ ngưỡng riêng cho từng camera.

MediaPipe Pose có thể được thử nghiệm ở camera một người vì cung cấp 33 landmark
và tọa độ 3D ước lượng. Với camera nhiều người/toàn cảnh, cần benchmark trước
khi thay YOLO Pose.

### Giai đoạn 6 — Bộ phân loại chuỗi keypoint

Khi có đủ dữ liệu, thay luật cố định bằng classifier nhẹ trên cửa sổ keypoint:

- Logistic Regression hoặc Random Forest làm baseline;
- MLP/1D-CNN trên đặc trưng hình học;
- LSTM/GRU hoặc Temporal Convolutional Network;
- ST-GCN nếu dữ liệu đủ lớn.

Đầu vào nên gồm tọa độ đã chuẩn hóa theo tâm hông và kích thước thân, confidence
keypoint, vận tốc và mask điểm bị thiếu. Đầu ra nên tách ít nhất:

```text
standing, sitting, bending, lying, falling, unknown
```

Không nên huấn luyện trực tiếp chỉ hai lớp `fall/not_fall`, vì các tư thế như
ngồi, cúi và nằm an toàn là hard negative quan trọng.

### Giai đoạn 7 — Huấn luyện/fine-tune pose

Nếu lỗi chủ yếu do keypoint kém trong môi trường thật, có thể fine-tune model
pose bằng ảnh từ đúng loại camera, đặc biệt với:

- người nhỏ ở xa;
- ánh sáng yếu hoặc ngược sáng;
- che khuất bởi nội thất;
- góc nhìn từ trên cao;
- chuyển động nhòe.

Nếu keypoint đã ổn nhưng phân loại ngã sai, ưu tiên cải thiện classifier thay vì
fine-tune model pose.

## 11. Thu thập dữ liệu và đánh giá

### Bộ dữ liệu cần có

Mỗi vị trí camera nên có các nhóm video:

- ngã thật theo nhiều hướng;
- ngồi nhanh xuống ghế;
- nằm xuống giường/sofa;
- cúi nhặt đồ và buộc dây giày;
- tập thể dục hoặc ngồi sàn;
- người đi qua nhau và bị che khuất;
- phòng trống;
- các điều kiện sáng khác nhau.

Không chỉ thu các ca ngã. Hard negative thường quyết định khả năng giảm báo sai.

### Chia dữ liệu

Nên chia train/validation/test theo người và theo video, không chia ngẫu nhiên
từng frame. Các frame liền nhau gần như giống nhau; chia từng frame sẽ làm rò rỉ
dữ liệu và tạo kết quả đánh giá quá lạc quan.

### Chỉ số cần theo dõi

- Event precision: tỷ lệ cảnh báo thực sự là ngã.
- Event recall: tỷ lệ ca ngã thật được phát hiện.
- False alarms per camera-hour/day.
- Missed falls per camera-hour/day.
- Time to detect: thời gian từ lúc bắt đầu ngã đến cảnh báo.
- Track ID switches.
- FPS, `processingMs`, CPU và RAM.

Đánh giá phải theo sự kiện, không chỉ theo frame. Một ca ngã kéo dài 100 frame
vẫn là một sự kiện.

## 12. Cách hiệu chỉnh các biến hiện tại

| Hiện tượng | Điều chỉnh đề xuất | Đánh đổi |
|---|---|---|
| Nhiều người đứng bị nhận nhầm | Tăng `POSE_CONFIDENCE` | Có thể bỏ sót người nhỏ |
| Cúi/ngồi bị báo ngã | Tăng `FALL_BBOX_RATIO`, giảm `FALL_TORSO_ANGLE` | Có thể bỏ sót ngã chéo |
| Cảnh báo do dao động ngắn | Tăng `FALL_CONFIRM_SECONDS` | Cảnh báo chậm hơn |
| Trạng thái ngã bị xóa quá sớm | Tăng `FALL_RECOVERY_SECONDS` | Giữ cảnh báo lâu hơn |
| CPU quá tải | Giảm `POSE_IMAGE_SIZE` từ 512 xuống 416 | Giảm chính xác người ở xa |
| Bỏ sót người ở xa | Tăng `POSE_IMAGE_SIZE` hoặc hạ `POSE_CONFIDENCE` | Chậm hơn hoặc tăng nhiễu |

Chỉ thay một biến mỗi lần và đánh giá trên cùng một tập video. Không chọn ngưỡng
dựa trên một vài ảnh quan sát thủ công.

## 13. Lộ trình khuyến nghị

1. Ghi log evidence, timestamp, trạng thái và track ID ra file đánh giá.
2. Thu hard negative và ca ngã tại đúng góc camera.
3. Đã chuyển xác nhận từ số frame sang thời gian thực.
4. Thêm vận tốc hông, tốc độ đổi góc thân và bất động sau ngã.
5. Thêm vùng sàn/vùng giường cho từng camera.
6. Đánh giá event precision, recall và false alarms mỗi ngày.
7. Chỉ chuyển sang classifier học máy khi bộ luật đã có dữ liệu benchmark rõ.
8. So sánh YOLO Pose và MediaPipe trên cùng video nếu có cấu hình một người.

## 14. Tiêu chí trước khi triển khai thực tế

- Chạy thử liên tục ít nhất vài ngày tại từng camera.
- Không có cảnh báo từ ảnh đơn hoặc session thiếu tracking.
- Home Assistant chỉ nhận một event cho mỗi ca ngã.
- Có cơ chế thông báo khi camera/model ngừng hoạt động.
- Lưu được đoạn video trước và sau cảnh báo để người vận hành xác minh.
- Ngưỡng được cấu hình riêng nếu các camera có góc nhìn khác nhau.
- Có quy trình con người kiểm tra cảnh báo và xử lý tình huống khẩn cấp.
