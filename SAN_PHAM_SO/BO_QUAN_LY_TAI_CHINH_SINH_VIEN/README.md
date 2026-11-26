# Bộ quản lý tài chính sinh viên

Bộ công cụ Excel tiếng Việt dành cho sinh viên theo dõi thu nhập, chi tiêu, ngân sách, mục tiêu tiết kiệm và ước tính lãi tiền gửi.

## Tài sản phát hành

- `Bo_quan_ly_tai_chinh_sinh_vien.xlsx` — workbook gồm 6 trang tính, dữ liệu minh họa, công thức tự động và biểu đồ.
- `Huong_dan_Bo_quan_ly_tai_chinh_sinh_vien.pdf` — cẩm nang sử dụng 6 trang.

**Bảo vệ sản phẩm:** repository `apk` hiện là repository công khai. Vì workbook và PDF là tài sản có thể dùng để kinh doanh, hai file phát hành không được commit vào nhánh công khai này. Bản phát hành được giữ riêng; repository chỉ lưu yêu cầu, lịch sử thay đổi, báo cáo QA và script kiểm thử.

## Chức năng

1. Ghi tối đa 200 giao dịch thu/chi trong vùng chuẩn bị sẵn.
2. Dashboard theo tháng hiện tại: tổng thu, tổng chi, số dư, tỷ lệ tiết kiệm, tình trạng ngân sách và biểu đồ theo nhóm.
3. Theo dõi tối đa 50 mục tiêu tiết kiệm.
4. Tính lãi đơn theo số ngày thực tế và cơ sở 365/366 ngày; có thêm phép tính quy đổi đơn theo tháng.
5. Danh mục Thu/Chi, nhóm và phương thức thanh toán để hỗ trợ nhập liệu.

## Kiểm thử cục bộ

Đặt hai tệp phát hành cùng thư mục với script kiểm thử, sau đó chạy:

```bash
python tests/test_workbook_integrity.py --workbook Bo_quan_ly_tai_chinh_sinh_vien.xlsx --pdf Huong_dan_Bo_quan_ly_tai_chinh_sinh_vien.pdf
```

Script dùng thư viện chuẩn Python, không cần cài thêm package. Kiểm tra này xác minh cấu trúc XLSX, công thức và giá trị mẫu đã lưu, vùng dropdown, số trang PDF và các lỗi công thức thường gặp. Đây là kiểm tra cấu trúc/tính toán; vẫn cần mở thử bằng Microsoft Excel trên máy tính trước khi phát hành rộng rãi.

## Giới hạn đã biết

- Dashboard tự chọn tháng hiện tại bằng `TODAY()`; chưa có bộ chọn tháng lịch sử.
- Workbook là công cụ quản lý cá nhân, không phải phần mềm kế toán hay tư vấn tài chính.
- Máy tính lãi chỉ dùng mô hình lãi đơn tham khảo, chưa mô phỏng lãi kép, thuế hoặc phí ngân hàng.
- Các số liệu mẫu phải được xóa hoặc thay thế trước khi dùng thật hoặc gửi khách hàng.

## Quy tắc phát hành

- Không commit dữ liệu tài chính cá nhân của người mua hoặc người tạo sản phẩm.
- Không đưa workbook/PDF thương mại lên repository công khai.
- Mỗi bản cập nhật phải tăng phiên bản, chạy script kiểm thử và render lại PDF để soát bố cục.
- Không quảng cáo doanh thu hoặc thu nhập của người mua như một kết quả được bảo đảm.
