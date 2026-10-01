# APK Runner

Trang web để tải file `.apk` và mở ứng dụng Android ngay trong trình duyệt.

## Chế độ chính: Web Cloud

Luồng chính là:

`Browser → APK Runner → Appetize Cloud Android → iframe trong Browser`

Appetize cung cấp Android ảo trên cloud và hỗ trợ nhúng thiết bị bằng iframe. APK có thể được upload qua REST API; API dùng header `X-API-KEY`. citehttps://docs.appetize.io/rest-api

Website của repo đã có sẵn:

- Chọn/kéo APK.
- Gửi APK đến Appetize từ server.
- Nhận `buildId`.
- Tự dựng embed URL.
- Hiển thị Android trong chính trang.
- Không cần Docker/KVM trên máy người dùng.

### Cấu hình Web Cloud

Cần một Appetize API token. Appetize yêu cầu API token để gọi REST API; token được tạo trong dashboard của tổ chức. citehttps://docs.appetize.io/rest-api

Tạo biến môi trường:

```env
APPETIZE_API_KEY=...
```

Không đưa token vào JavaScript frontend và không commit token lên Git.

Sau khi có token, chạy server Node:

```bash
npm start
```

Mở:

```
http://localhost:8080
```

Ở môi trường production, deploy Node server lên hosting có HTTPS và lưu `APPETIZE_API_KEY` dưới dạng secret. GitHub Pages chỉ phù hợp với frontend tĩnh; phần upload giữ API token cần backend/serverless.

## Chế độ phụ: Android Emulator cục bộ

Repository vẫn giữ một chế độ self-host bằng Docker:

`Browser → Node → ADB → Android Emulator → noVNC`

Chạy trên máy có Docker/KVM:

```bash
docker compose up -d --build
```

Windows có thể dùng:

```powershell
.\start.ps1
```

Dừng:

```powershell
.\stop.ps1
```

## Lưu ý tương thích

Chế độ Web Cloud dùng Android emulator thật do nhà cung cấp cloud quản lý nên phù hợp hơn browser-native WASM cho APK hiện đại. Một số APK vẫn có thể không chạy do yêu cầu ABI, Android API, Play Services, phần cứng hoặc chính sách của dịch vụ.

File `Tiệm Truyện Chữ.apk` được dùng làm file tham khảo; không commit vào repository.

## Bảo mật

Chỉ chạy APK mà bạn có quyền kiểm thử. Không dùng hệ thống này để phát tán hoặc kiểm thử phần mềm độc hại. Không công khai API token. Với public deployment nên thêm rate limit, giới hạn kích thước, xác thực người dùng và log/audit.

