# APK Runner

Trang web để tải file `.apk` và mở ứng dụng Android ngay trong trình duyệt.

## Chế độ chính: Web Cloud

Luồng chính:

`Browser → APK Runner → Ramus Cloud Android → browser watch link`

Ramus cung cấp Android emulator chạy trên cloud và cho phép chạy APK trong trình duyệt. Trial CLI hiện cho phép dùng không cần tài khoản, 1 phiên hoạt động, APK tối đa 150 MB và trả về một `watchUrl`. ([Ramus](https://ramus.dev/), [pricing](https://ramus.dev/pricing))

Website của repo đã có sẵn:

- Chọn/kéo APK.
- Gửi APK từ server lên Ramus.
- Tự tạo phiên Android cloud.
- Nhận `watchUrl`.
- Hiển thị phiên Android trong chính trang.
- Không cần Docker/KVM trên máy người dùng.

### Deploy thành website có URL

Repo có `render.yaml` để deploy thành Node Web Service trên Render. Render hỗ trợ deploy Node app từ GitHub và cấp URL `onrender.com`. ([Render](https://render.com/docs/deploy-node-hapi-app))

Bạn có thể dùng nút **Deploy to Render** trong README/GitHub hoặc tạo Web Service từ repository.

Không cần lưu API key Ramus trong source. Backend dùng trial CLI của Ramus.

## Chế độ phụ: Android Emulator cục bộ

Repository vẫn giữ một chế độ self-host bằng Docker:

`Browser → Node → ADB → Android Emulator → noVNC`

Chạy trên máy có Docker/KVM:

```bash
docker compose up -d --build
```

Windows:

```powershell
.\start.ps1
```

Dừng:

```powershell
.\stop.ps1
```

## Giới hạn Web Cloud trial

Ramus công bố trial miễn phí với tối đa 60 phút CLI access, 1 Android session đang hoạt động, APK tối đa 150 MB và mặc định tối đa 3 trial mỗi IP mỗi ngày. Phiên thường hết sau 30 phút không có thao tác. Watch link có hiệu lực mặc định 72 giờ nhưng không giữ emulator chạy liên tục. ([Ramus pricing](https://ramus.dev/pricing))

## Tương thích

Ramus hiện chạy APK trên Android emulator x86_64; native libraries, phụ thuộc phần cứng hoặc dịch vụ bên ngoài có thể ảnh hưởng khả năng chạy. ([Ramus APK testing](https://ramus.dev/products/test-apps-online))

File `Tiệm Truyện Chữ.apk` chỉ là file tham khảo và không được commit vào repository.

## Bảo mật và quyền sử dụng

Chỉ tải và chạy APK mà bạn có quyền kiểm thử. Không dùng dịch vụ cloud làm điện thoại từ xa hoặc cho mục đích vượt giới hạn dịch vụ. Ramus yêu cầu sử dụng cho build, test và review ứng dụng Android. ([Ramus AUP](https://ramus.dev/acceptable-use))

