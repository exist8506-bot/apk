# APK Runner

Trang web tự host để tải file `.apk`, cài vào Android Emulator chạy trong Docker và điều khiển thiết bị Android ngay trong trình duyệt.

## Kiến trúc

`Browser → APK Runner web → ADB → Android Emulator → noVNC`

Website chỉ là lớp điều khiển. APK được chạy trong Android Emulator thật, không được thực thi trực tiếp bằng JavaScript của trình duyệt.

## Chạy

### Yêu cầu

- Docker + Docker Compose.
- Máy chủ có hardware virtualization/KVM để emulator chạy tốt.
- Mở được các cổng 8080 (website) và 6080 (noVNC).

### Khởi động

```bash
docker compose up -d --build
```

Sau đó mở:

- Website: `http://localhost:8080`
- noVNC trực tiếp: `http://localhost:6080`

Lần boot đầu của Android Emulator có thể lâu. Trên Windows, khả năng `/dev/kvm` phụ thuộc vào môi trường Docker/WSL2; Linux có KVM thường phù hợp hơn.

## Luồng sử dụng

1. Kéo file APK vào trang.
2. Server kiểm tra ZIP/APK và đọc application ID bằng Android `apkanalyzer`.
3. Bấm **Cài & mở APK**.
4. Server dùng ADB cài APK vào emulator và gọi `monkey` để mở package.
5. Màn hình Android được hiển thị và điều khiển bằng noVNC.

## Bảo mật

Bản đầu tiên dành cho chạy cục bộ/self-host. Không công khai cổng ADB `5555` ra Internet. Nếu triển khai public cần thêm xác thực, HTTPS, giới hạn phiên, sandbox, quota và cô lập network trước khi cho người lạ tải APK.

## Ghi chú về APK mẫu

File mẫu được dùng để kiểm tra tính đa DEX/Android compatibility, không cần commit vào repository. Repository không chứa APK người dùng tải lên; các file upload nằm trong `data/uploads/` và bị `.gitignore` loại khỏi Git.
