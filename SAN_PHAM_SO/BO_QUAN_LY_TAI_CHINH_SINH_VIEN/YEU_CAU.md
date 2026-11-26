# Yêu cầu sản phẩm — Bộ quản lý tài chính sinh viên

## 1. Mục tiêu kinh doanh và vận hành

- Sản phẩm số: bộ quản lý tài chính cá nhân dành cho sinh viên.
- Định dạng bàn giao: Excel `.xlsx` và hướng dẫn PDF bằng tiếng Việt.
- Chi phí khởi đầu: 0 đồng; ưu tiên công cụ sẵn có.
- Thiết bị triển khai: laptop phổ thông, không phụ thuộc GPU rời; điện thoại Android dùng để kiểm tra/nhận thông báo.
- Kết nối mạng: Wi-Fi có giới hạn dung lượng; hạn chế dịch vụ chạy nền hoặc truyền dữ liệu liên tục.
- Cách vận hành: đầu tư công sức chủ yếu khi thiết lập sản phẩm; sau đó kiểm tra định kỳ, tự động giao file nếu nền tảng bán hỗ trợ.
- Mục tiêu doanh thu tham khảo: 500.000–1.000.000đ/tháng. Đây là mục tiêu kế hoạch, không phải cam kết hoặc dự báo chắc chắn.

## 2. Đối tượng sử dụng

Sinh viên và người mới đi làm cần một file dễ hiểu để ghi nhận thu nhập, phân loại chi tiêu, đặt ngân sách và theo dõi mục tiêu tiết kiệm.

## 3. Yêu cầu chức năng

### BAT_DAU
- Giải thích quy trình sử dụng, quy ước màu và cảnh báo trước khi nhập dữ liệu thật.

### DASHBOARD
- Tự chọn tháng báo cáo hiện tại bằng `TODAY()`.
- Tính tổng thu và tổng chi trong tháng bằng `SUMIFS`.
- Tính số dư = tổng thu - tổng chi.
- Tính tỷ lệ tiết kiệm; nếu tổng thu bằng 0 thì hiển thị 0%.
- Tổng hợp chi theo 10 nhóm ngân sách, tính số còn lại và trạng thái trong/vượt ngân sách.
- Có biểu đồ so sánh ngân sách và thực chi theo nhóm.

### GIAO_DICH
- Chuẩn bị 200 dòng nhập liệu, từ dòng 6 đến 205.
- Trường dữ liệu: Ngày, Loại, Nhóm, Nội dung, Số tiền, Phương thức, Ghi chú.
- Có dropdown cho Loại, Nhóm và Phương thức.
- Số tiền nhập số dương; phân biệt thu/chi bằng cột Loại.

### MUC_TIEU
- Chuẩn bị công thức cho tối đa 50 mục tiêu, từ dòng 5 đến 54.
- Tự tính số còn thiếu = `MAX(Số tiền mục tiêu - Đã tiết kiệm, 0)`.
- Tự tính tiến độ; không chia cho 0 và giới hạn tối đa 100%.

### TINH_LAI
- Tính lãi đơn theo ngày: `Tiền gốc × Lãi suất năm × Số ngày thực tế / Cơ sở tính ngày`.
- Cho phép chọn cơ sở ngày 365 hoặc 366; có thêm ước tính quy đổi đơn theo số tháng chia 12.
- Đầu vào âm hoặc cơ sở ngày không hợp lệ không được tạo lỗi chia cho 0; kết quả lãi trả về 0.
- Nêu rõ đây là ước tính tham khảo, không thay thế bảng tính lãi của ngân hàng.

### DANH_MUC
- Lưu danh sách tham chiếu cho loại giao dịch, nhóm và phương thức thanh toán.

## 4. Yêu cầu chất lượng

- Giao diện tiếng Việt, màu sắc nhất quán, ô nhập liệu và ô công thức phân biệt rõ.
- Định dạng tiền Việt Nam, tỷ lệ phần trăm và ngày tháng hợp lý.
- Có dữ liệu mẫu có ghi nhãn để người mua nhìn thấy cách dùng.
- Có hướng dẫn PDF ngắn gọn; không có chữ bị cắt, đè lên nhau hoặc lỗi font khi render.
- Workbook không chứa thông tin tài khoản, mật khẩu, số thẻ hoặc dữ liệu tài chính thật.
- Tương thích định dạng `.xlsx`; kiểm tra trên Microsoft Excel trước khi phát hành chính thức.

## 5. Tiêu chí nghiệm thu

- Đủ 6 trang tính: BAT_DAU, DASHBOARD, GIAO_DICH, MUC_TIEU, TINH_LAI, DANH_MUC.
- Dashboard khớp số liệu mẫu: tổng thu 3.700.000đ; tổng chi 595.000đ; còn lại 3.105.000đ; tỷ lệ tiết kiệm xấp xỉ 83,9%.
- Máy tính lãi mẫu: 4.000.000đ, 7,1%/năm, 182 ngày, cơ sở 365 ngày; lãi khoảng 141.611đ; tổng khoảng 4.141.611đ.
- Dashboard chỉ cộng giao dịch thuộc tháng báo cáo; không cộng nhầm tháng sau.
- Dòng giao dịch cuối vùng (dòng 205) vẫn được tính.
- Công thức mục tiêu có sẵn tới dòng 54.
- Không có lỗi công thức phổ biến `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, `#N/A`.
- PDF được render và soát đủ số trang trước phát hành.

## 6. Giới hạn phiên bản

- Chưa có báo cáo lịch sử nhiều tháng hoặc bộ chọn tháng.
- Chưa có quản lý khoản nợ, lịch nhắc thanh toán, lãi kép, thuế hoặc phí ngân hàng.
- Chưa đảm bảo thu nhập bán hàng; cần kiểm chứng nhu cầu và phương thức thanh toán trước khi chọn nền tảng thương mại.
