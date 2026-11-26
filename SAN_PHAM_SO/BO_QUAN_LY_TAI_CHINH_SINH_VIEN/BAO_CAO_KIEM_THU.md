# Báo cáo kiểm thử — workbook v1.1

**Trạng thái:** PASS cho các kiểm tra cấu trúc và ca tính toán cục bộ. Chưa xác nhận bằng Microsoft Excel desktop thực tế.

## Đã kiểm tra

| Hạng mục | Dữ liệu thử | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| Dashboard tổng thu | Bộ dữ liệu mẫu | 3.700.000đ | PASS |
| Dashboard tổng chi | Bộ dữ liệu mẫu | 595.000đ | PASS |
| Số dư | Thu trừ chi | 3.105.000đ | PASS |
| Tỷ lệ tiết kiệm | 3.105.000 / 3.700.000 | khoảng 83,9% | PASS |
| Tiền lãi ngày thực tế | 4.000.000 × 7,1% × 182 / 365 | 141.610,96đ | PASS |
| Tổng gốc + lãi | 4.000.000 + tiền lãi | 4.141.610,96đ | PASS |
| Mục tiêu tiết kiệm | Mục tiêu 3.000.000đ, đã tiết kiệm 1.500.000đ | Còn 1.500.000đ, tiến độ 50% | PASS |
| Lọc tháng | 2 giao dịch tháng 11, 1 giao dịch tháng 12 | Không cộng giao dịch tháng 12 vào tháng 11 | PASS |
| Dòng cuối vùng nhập | Giao dịch ở dòng 205 | Được tính vào tổng tháng | PASS |
| Đầu vào không hợp lệ | Cơ sở ngày = 0 | Tiền lãi trả về 0, không chia cho 0 | PASS |
| Vùng công thức mục tiêu | Dòng 5–54 | Công thức còn ở D54/E54 | PASS |
| Lỗi công thức | Quét các lỗi Excel phổ biến | Không phát hiện | PASS |
| PDF | Render bằng công cụ PDF, 6 trang | Không thấy trang bị cắt nội dung | PASS |

## Kết quả kiểm tra bổ sung

- Tệp XLSX là ZIP hợp lệ; không có lỗi khi kiểm tra CRC.
- Các dropdown nhập liệu áp dụng tại `B6:B205`, `C6:C205`, `F6:F205`.
- Dashboard được render toàn vùng `A1:O24`; KPI và biểu đồ hiển thị đúng bố cục. Nếu render chỉ tới cột H thì phần biểu đồ bên phải sẽ không xuất hiện.
- Trang tính MUC_TIEU có công thức kéo sẵn tới dòng 54.
- PDF cẩm nang có 6 trang và đã được render để kiểm tra trực quan.

## Giới hạn kiểm thử

- Công thức và giá trị cache được kiểm tra bằng `artifact_tool` cùng XML bên trong tệp XLSX; chưa mở bằng Microsoft Excel desktop trên Windows.
- Việc hiển thị biểu đồ và xác thực dữ liệu có thể khác nhẹ giữa Excel và ứng dụng bảng tính di động.
- Trước khi bán rộng rãi, cần một vòng UAT trên Excel desktop và thử thao tác với người dùng độc lập.
