# Mạch Nhớ — Bộ nhớ hội thoại cá nhân

Mạch Nhớ là một ứng dụng web tĩnh giúp gom các cuộc trò chuyện thành thư viện có thể tìm kiếm, đề xuất ghi nhớ dài hạn và chuyển thông tin đã chọn vào một cuộc trò chuyện AI mới.

## Tính năng

- Nhập gói xuất ChatGPT (conversations.json) hoặc các file TXT, Markdown, HTML có nội dung hội thoại.
- Tạo chỉ mục tìm kiếm cục bộ, phân loại chủ đề và bản tóm tắt sơ bộ bằng quy tắc tại trình duyệt.
- Đề xuất ghi nhớ và việc cần làm; bạn phải duyệt trước khi lưu vào danh sách chính thức.
- Thêm, sửa, ghim và xóa ghi nhớ; tìm kiếm trên thư viện.
- Xem và sao chép bản ghi hội thoại; xuất thư viện Markdown.
- Sao lưu/khôi phục JSON, sao chép gói ghi nhớ và prompt để nhờ AI phân tích sâu.
- Giao diện tương thích máy tính/điện thoại và có thể cache để mở lại khi offline.

## Bắt đầu

### Dùng GitHub Pages

Repo có workflow tại .github/workflows/pages.yml. Trong Settings → Pages, chọn GitHub Actions làm nguồn triển khai (chỉ cần thiết lập ban đầu nếu repo chưa bật Pages). Mỗi lần push lên main, workflow sẽ kiểm tra cú pháp và triển khai thư mục public/.

Sau khi workflow hoàn tất, mở URL Pages được hiển thị trong phần Settings → Pages của repo.

### Chạy trên máy

Dùng Node.js 20+:

    npm run check
    npm run serve

Sau đó mở http://localhost:8080. Có thể dùng một máy chủ tĩnh tương thích để phục vụ thư mục public/; nếu mở trực tiếp file HTML bằng file://, trình duyệt có thể chặn service worker.

## Nhập dữ liệu ChatGPT

1. Trong ChatGPT, vào Settings → Data Controls → Export Data và yêu cầu xuất dữ liệu.
2. Tải gói ZIP khi nhận được, giải nén trên thiết bị cá nhân.
3. Trong Mạch Nhớ, chọn Nhập hội thoại và chọn file conversations.json. Có thể nhập nhiều file một lượt.
4. Xem các ghi nhớ được gợi ý trên trang Tổng quan. Chỉ lưu những gì còn đúng và thực sự hữu ích.

Ứng dụng không thể tự đọc lịch sử ChatGPT, không đăng nhập thay bạn và không đồng bộ tự động với tài khoản ChatGPT.

## Riêng tư và giới hạn

- Mạch Nhớ là app tĩnh: không có API backend nhận hội thoại. Dữ liệu được lưu trong IndexedDB của trình duyệt hiện tại.
- Nội dung được phân tích tại máy bằng quy tắc từ khóa. Đây không phải mô hình AI; tóm tắt và phân loại có thể sai, bỏ sót ngữ cảnh hoặc hiểu nhầm câu phủ định.
- Các ghi nhớ rút ra từ hội thoại chỉ là gợi ý và cần người dùng xác nhận trước khi được lưu.
- Dữ liệu trình duyệt không phải một kho mã hóa chuyên dụng. Người có quyền sử dụng cùng hồ sơ trình duyệt có thể truy cập dữ liệu; bản sao lưu JSON được xuất ra không mã hóa.
- Hãy sao lưu định kỳ, không dùng máy dùng chung để lưu dữ liệu riêng tư, và tránh nhập mật khẩu, token, số thẻ hay thông tin cực kỳ nhạy cảm.
- Việc xóa dữ liệu trình duyệt hoặc chuyển sang thiết bị/trình duyệt khác có thể làm mất dữ liệu chưa sao lưu.
- Mạch Nhớ không phải bộ nhớ nội bộ của ChatGPT. Để đưa ngữ cảnh vào một cuộc trò chuyện mới, hãy dùng Sao chép gói nhớ rồi tự dán vào cuộc trò chuyện đó.

## Kiểm tra

    npm run check

Lệnh kiểm tra cú pháp JavaScript/service worker, JSON manifest và các file tĩnh quan trọng. Nó không thay thế việc kiểm tra thủ công trên các trình duyệt mục tiêu.
