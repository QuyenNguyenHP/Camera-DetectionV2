# Portable Camera Detection Docker bundle

This bundle builds one CPU-only Docker image containing:

- The production React frontend.
- The FastAPI backend.
- All Python runtime libraries.
- YOLO-World, YuNet and SFace model files.
- MediaPipe hand gesture recognition and its offline model.
- Runtime defaults from `runtime.env`.

After the image archive is built and copied, the target PC only needs Docker. It
does not need Node.js, Python, the source repository, or Internet access.

## 1. Build and export on the build PC

Docker Engine or Docker Desktop must be installed and running.

From the project root:

```bash
chmod +x docker_camera_detection/*.sh
./docker_camera_detection/build_and_export.sh
```

The first build requires Internet access to download base images and install
Node/Python packages. It creates:

```text
docker_camera_detection/camera-detection-1.1.0-cpu.tar
docker_camera_detection/camera-detection-1.1.0-cpu.tar.sha256
```

The archive contains the application, CPU-only runtime libraries, and all four
model files. PyTorch is installed from its official CPU wheel index; CUDA,
cuDNN, NVIDIA runtime packages and build-only Git tools are excluded from the
final image. OpenCV also uses its headless package because the browser provides
the user interface.
Before exporting, the script loads YOLO-World, YuNet, SFace and MediaPipe inside the image,
starts a temporary container, and verifies the packaged API health endpoint.
The target-PC script verifies the SHA-256 checksum before loading the archive.

The default target is `linux/amd64`. To attempt an ARM64 build:

```bash
TARGET_PLATFORM=linux/arm64 ./docker_camera_detection/build_and_export.sh
```

Only use ARM64 when every Python dependency supports the target platform.

## 2. Copy to another PC

Copy the entire `docker_camera_detection` folder, including the generated `.tar`
file, to the target PC. The target needs Docker Engine with the Compose plugin,
but it does not need Internet access.

## 3. Load and run on the target PC

If you already set a default `INITIAL_ADMIN_PASSWORD` in `docker-compose.yml`,
load and start the application with:

```bash
cd docker_camera_detection
chmod +x *.sh
./load_and_run.sh
```

Writing a password directly in `docker-compose.yml` exposes it to anyone who can
read that file or inspect the container. Use it only to create the first admin.
After the first successful login, change the Compose entry back to:

```yaml
INITIAL_ADMIN_PASSWORD: ${INITIAL_ADMIN_PASSWORD:-}
```

Then recreate the container. The existing account remains in the persistent
volume:

```bash
docker compose up -d --force-recreate
```

The backend creates the admin only when the user database is empty. On later
starts, the environment password is ignored and is no longer required. Sign in
as `admin`, open **Identity enrollment**, then use **User management** to create
additional `user` or `admin` accounts.

For a quick test on the server itself, open:

```text
http://localhost:8080
```

For access from another PC and camera permission, complete the Apache2 HTTPS
configuration below.

## 4. Stop, restart, and inspect

```bash
./stop.sh
docker compose up -d
docker compose logs -f camera-detection
```

## Persistent enrollment data

User accounts, sessions, face embeddings and enrollment photos are stored in
the Docker volume:

```text
camera-detection-data
```

The account database is `/app/backend/data/users.db`. Passwords are stored as
Argon2id hashes, never as plaintext. A `user` can access Scan; an `admin` can
also access Identity Enrollment and create accounts. These records survive
container replacement and `docker compose down`. Do not run
`docker compose down -v` unless you intentionally want to delete all enrollment
and account data.

## Environment configuration

Edit `runtime.env` before starting the container to change confidence thresholds,
upload limits, tracking behavior, or CPU thread count. `YOLO_DEVICE=cpu` keeps
inference on the CPU even if the host has an NVIDIA GPU. Recreate the container
after a change:

```bash
docker compose up -d --force-recreate
```

Keep `AUTH_COOKIE_SECURE=true` for domain/HTTPS deployments. If the app is used
only through direct local HTTP during development and the browser refuses the
cookie, set it to `false`; change it back to `true` before exposing the service.

## Truy cập từ PC khác qua HTTPS bằng Apache2 (khuyến nghị)

Trình duyệt chỉ cho phép web app sử dụng camera khi trang chạy trên `localhost`
hoặc HTTPS. Vì vậy, `http://SERVER_IP:8080` có thể hiển thị giao diện nhưng không
mở được camera. Cấu hình khuyến nghị là:

```text
PC người dùng -> HTTPS/Apache2 :443 -> 127.0.0.1:8080 -> Docker
```

Hướng dẫn dưới đây dùng ví dụ:

```text
Domain: camera.example.com
IP LAN của server: 192.168.1.100
```

Thay các giá trị ví dụ bằng domain và địa chỉ thật của bạn.

### Bước 1: Chuẩn bị DNS và router

Tạo bản ghi DNS `A`:

```text
Type:  A
Name:  camera
Value: PUBLIC_IP_CUA_MANG
```

Gán IP LAN cố định cho PC chạy Docker, sau đó cấu hình port forwarding trên
router:

```text
TCP 80  -> 192.168.1.100:80
TCP 443 -> 192.168.1.100:443
```

Không forward cổng `8080`. File `docker-compose.yml` mặc định chỉ publish ứng
dụng tại `127.0.0.1:8080`, vì vậy chỉ Apache2 trên chính server có thể truy cập
cổng này.

Nếu WAN IP trên router không giống public IP hiển thị trên Internet, mạng có thể
đang dùng CGNAT. Trong trường hợp đó, cần yêu cầu ISP cấp public IP hoặc sử dụng
một dịch vụ tunnel.

### Bước 2: Cài Apache2 và Certbot

Trên Ubuntu/Debian, chạy:

```bash
sudo apt update
sudo apt install -y apache2 certbot python3-certbot-apache
sudo a2enmod proxy proxy_http headers rewrite ssl
sudo systemctl enable --now apache2
```

Apache2 sẽ tự khởi động lại sau khi PC/server được bật. Docker Compose đã dùng
`restart: unless-stopped`, nên container ứng dụng cũng tự khởi động lại, trừ khi
bạn đã chủ động stop container trước lúc tắt máy.

### Bước 3: Tạo Apache VirtualHost

Tạo file cấu hình:

```bash
sudo nano /etc/apache2/sites-available/camera-detection.conf
```

Điền nội dung sau và thay `camera.example.com` bằng domain thật:

```apache
<VirtualHost *:80>
    ServerName camera.example.com

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:8080/ connectiontimeout=5 timeout=300
    ProxyPassReverse / http://127.0.0.1:8080/

    RequestHeader set X-Forwarded-Proto "https" env=HTTPS
    Header always set Permissions-Policy "camera=(self)"
    Header always set X-Content-Type-Options "nosniff"

    ErrorLog ${APACHE_LOG_DIR}/camera-detection-error.log
    CustomLog ${APACHE_LOG_DIR}/camera-detection-access.log combined
</VirtualHost>
```

Kích hoạt site và kiểm tra cấu hình:

```bash
sudo a2ensite camera-detection.conf
sudo a2dissite 000-default.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

Kết quả `apache2ctl configtest` phải là `Syntax OK`.

### Bước 4: Khởi động Docker và kiểm tra backend

```bash
cd docker_camera_detection
docker compose up -d --force-recreate
docker compose ps
curl http://127.0.0.1:8080/api/health
```

Nếu Docker báo thiếu image, hãy load archive trước:

```bash
sha256sum -c camera-detection-1.1.0-cpu.tar.sha256
docker load -i camera-detection-1.1.0-cpu.tar
docker compose up -d
```

Kiểm tra Apache chuyển tiếp được yêu cầu đến ứng dụng:

```bash
curl -I -H 'Host: camera.example.com' http://127.0.0.1/
```

### Bước 5: Cấp chứng chỉ HTTPS

Đảm bảo domain đã trỏ đúng public IP và router đã forward cổng `80`, `443` trước
khi chạy:

```bash
sudo certbot --apache -d camera.example.com --redirect
```

Certbot sẽ tạo VirtualHost HTTPS, cấu hình chuyển HTTP sang HTTPS và tự cài lịch
gia hạn chứng chỉ. Kiểm tra việc gia hạn:

```bash
sudo certbot renew --dry-run
```

Sau khi Certbot hoàn tất, mở:

```text
https://camera.example.com
```

Không nên mở ứng dụng bằng `http://SERVER_IP`, vì trình duyệt sẽ không cho phép
website HTTP từ máy khác sử dụng camera.

### Bước 6: Mở firewall

Nếu server sử dụng UFW:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Hoặc dùng profile có sẵn của Apache:

```bash
sudo ufw allow 'Apache Full'
```

Kiểm tra dịch vụ và log nếu không truy cập được:

```bash
sudo systemctl status apache2
sudo tail -n 100 /var/log/apache2/camera-detection-error.log
docker compose logs --tail=100 camera-detection
```

Trình duyệt phải hiển thị kết nối an toàn, sau đó người dùng chọn **Allow
camera**. Kiểm tra từ mạng ngoài bằng điện thoại dùng 4G/5G, không chỉ kiểm tra
trong cùng Wi-Fi.

Nếu truy cập được từ Internet nhưng không truy cập được trong LAN, router có thể
không hỗ trợ NAT loopback. Hãy cấu hình DNS nội bộ để `camera.example.com` trỏ về
IP LAN `192.168.1.100`; chứng chỉ HTTPS vẫn hợp lệ vì người dùng tiếp tục truy cập
bằng đúng domain.

### Bước 7: Kiểm tra xác thực trước khi public

Ứng dụng có sẵn đăng nhập và phân quyền. Hãy kiểm tra các điều kiện sau trước khi
mở ra Internet:

- Tài khoản `user` chỉ nhìn thấy và gọi được chức năng Scan.
- Chỉ tài khoản `admin` nhìn thấy Identity Enrollment và User Management.
- `AUTH_COOKIE_SECURE=true` trong `runtime.env` khi chạy qua HTTPS.
- Không public trực tiếp cổng `8080`; chỉ public cổng Apache2 `80/443`.
- Sao lưu volume `camera-detection-data` vì nó chứa `users.db`, ảnh và embeddings.

Session được lưu bằng cookie `HttpOnly`, còn thông tin tài khoản được lưu trong
SQLite tại `/app/backend/data/users.db`. Không lưu session token hoặc quyền admin
trong `localStorage` của trình duyệt.

## Production capacity note

This portable image runs one inference worker because the model and face store
hold process-local state. It is suitable for a single machine or a small pilot.
Before serving many simultaneous Live Scan users, migrate identity data to a
database/object store and load-test inference throughput.
