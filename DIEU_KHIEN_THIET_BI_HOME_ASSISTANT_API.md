# Điều khiển thiết bị qua API của Home Assistant

Để điều khiển thiết bị qua API của Home Assistant, bạn chỉ cần nắm rõ các thành phần cơ bản sau đây. Đây là bản tóm tắt đầy đủ, dễ hiểu và có thể thực hành ngay.

## 🧩 1. Các thành phần cần có

| Thành phần | Mô tả | Ví dụ |
| --- | --- | --- |
| **Home Assistant URL** | Địa chỉ truy cập Home Assistant trong mạng nội bộ hoặc từ xa | `http://homeassistant.local:8123` hoặc `http://192.168.1.100:8123` |
| **Long-Lived Access Token** | Mã truy cập dùng để xác thực khi gọi API | `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...` |
| **Endpoint (API URL)** | Đường dẫn cụ thể của dịch vụ hoặc thực thể muốn điều khiển | `/api/services/switch/turn_on` |
| **HTTP Method** | Phương thức HTTP | `POST` để điều khiển, `GET` để xem trạng thái |
| **Headers** | Thông tin xác thực và kiểu dữ liệu | `Authorization: Bearer <TOKEN>` và `Content-Type: application/json` |
| **Request Body (Payload)** | Dữ liệu JSON mô tả thiết bị muốn tác động | `{"entity_id": "switch.t1_chieu_sang_switch_3"}` |

## ⚙️ 2. Cấu trúc mẫu lệnh cURL

Ví dụ: **tắt công tắc** `switch.t1_chieu_sang_switch_3`:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_LONG_LIVED_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "switch.t1_chieu_sang_switch_3"}' \
  http://HOME_ASSISTANT_URL/api/services/switch/turn_off
```

Tương tự:

- **Bật thiết bị:** `/api/services/switch/turn_on`
- **Tắt thiết bị:** `/api/services/switch/turn_off`
- **Xem trạng thái:** `GET /api/states/switch.t1_chieu_sang_switch_3`

## 🧠 3. Cấu trúc logic của API trong Home Assistant

```text
/api/
 ├── states/                    → Xem hoặc chỉnh trạng thái thực thể
 │    └── <entity_id>           → Trạng thái cụ thể
 │
 ├── services/                  → Gọi hành động (turn_on, turn_off, toggle, …)
 │    └── <domain>/<service>    → Ví dụ: switch/turn_on, light/toggle
 │
 ├── events/                    → Gửi hoặc nhận event tùy chỉnh
 ├── config/                    → Lấy thông tin cấu hình Home Assistant
 ├── history/                   → Lấy lịch sử trạng thái
 └── template/                  → Chạy template Jinja2
```

## 🔐 4. Xác thực (Authentication)

Sử dụng **Bearer Token** trong header:

```http
Authorization: Bearer <YOUR_LONG_LIVED_ACCESS_TOKEN>
```

Token được tạo trong Home Assistant tại:

**Profile → Long-Lived Access Tokens → Create Token**

> ⚠️ Token có quyền tương ứng với tài khoản của bạn, vì vậy không chia sẻ công khai hoặc đưa token thật vào mã nguồn.

## 🧰 5. Một số endpoint hữu ích khác

| Mục đích | Method | Endpoint | Ví dụ |
| --- | --- | --- | --- |
| Lấy danh sách trạng thái của tất cả entity | `GET` | `/api/states` | Xem toàn bộ cảm biến và công tắc |
| Lấy trạng thái của một entity | `GET` | `/api/states/light.phong_khach` | Xem đèn phòng khách |
| Thay đổi trạng thái thủ công | `POST` | `/api/states/<entity_id>` | Dùng cho mô phỏng |
| Gọi service bật đèn | `POST` | `/api/services/light/turn_on` | JSON chứa `entity_id` |
| Gửi sự kiện tùy chỉnh | `POST` | `/api/events/<event_name>` | Dùng cho automation nâng cao |

## 📋 6. Tóm tắt ngắn gọn

Để điều khiển thiết bị qua API của Home Assistant, bạn cần:

1. **Địa chỉ Home Assistant**
2. **Long-Lived Access Token**
3. **Entity ID** của thiết bị
4. **Endpoint dịch vụ** (`/api/services/...`)
5. **Phương thức `POST` và JSON body**
6. **Header xác thực Bearer Token**

## 🧪 7. Ví dụ thực hành

Đặt URL và token vào biến môi trường trước khi chạy các lệnh. Cách này giúp tránh ghi trực tiếp token vào lịch sử lệnh hoặc mã nguồn:

```bash
export HA_URL="https://home.dqtech.cloud"
export HA_TOKEN="YOUR_LONG_LIVED_ACCESS_TOKEN"
```

> ⚠️ Không commit token thật vào Git. Nếu token đã được chia sẻ hoặc xuất hiện trong tài liệu, hãy thu hồi token đó và tạo token mới.

### Kiểm tra kết nối tới API

```bash
curl -X GET \
  -H "Authorization: Bearer ${HA_TOKEN}" \
  -H "Content-Type: application/json" \
  "${HA_URL}/api/"
```

Nếu kết nối và xác thực thành công, Home Assistant sẽ trả về thông báo API đang hoạt động.

### Lấy trạng thái của tất cả entity

```bash
curl -X GET \
  -H "Authorization: Bearer ${HA_TOKEN}" \
  -H "Content-Type: application/json" \
  "${HA_URL}/api/states"
```

### Xem danh sách Entity ID

Lệnh này cần cài đặt `jq`:

```bash
curl -s -X GET \
  -H "Authorization: Bearer ${HA_TOKEN}" \
  -H "Content-Type: application/json" \
  "${HA_URL}/api/states" | jq -r '.[].entity_id'
```

### Xem trạng thái của một entity cụ thể

Ví dụ với công tắc `switch.t1_chieu_sang_switch_3`:

```bash
curl -X GET \
  -H "Authorization: Bearer ${HA_TOKEN}" \
  -H "Content-Type: application/json" \
  "${HA_URL}/api/states/switch.t1_chieu_sang_switch_3"
```

Ví dụ với đèn `light.phong_khach`:

```bash
curl -X GET \
  -H "Authorization: Bearer ${HA_TOKEN}" \
  -H "Content-Type: application/json" \
  "${HA_URL}/api/states/light.phong_khach"
```

### Truy cập Home Assistant bằng địa chỉ IP

Nếu API chỉ được truy cập trực tiếp qua mạng nội bộ hoặc địa chỉ IP, hãy thay `HA_URL`:

```bash
export HA_URL="http://218.212.167.168:8123"

curl -X GET \
  -H "Authorization: Bearer ${HA_TOKEN}" \
  -H "Content-Type: application/json" \
  "${HA_URL}/api/states/switch.t1_chieu_sang_switch_3"
```
