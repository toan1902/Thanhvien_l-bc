# LĐBC — Danh sách thành viên trực tuyến

Khi quản trị viên thêm/sửa/xóa, thay ảnh, nhập hồ sơ hoặc khôi phục JSON, trang tự gửi bản đã lưu lên kho dữ liệu. Khách mở QR nhận dữ liệu mới; trang đang mở cập nhật mỗi 30 giây hoặc khi quay lại tab. QR không thay đổi.

## Bật lần đầu trên Vercel

1. Trong dự án **thanhvien-ldbc**, mở **Storage → Create Database → Upstash Redis**, chọn gói phù hợp và kết nối với dự án. Kiểm tra giá/gói trong màn hình của nhà cung cấp trước khi tạo.
2. Trong **Settings → Environment Variables**, bảo đảm có `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN` cho Production. Mã cũng hỗ trợ `KV_REST_API_URL` và `KV_REST_API_TOKEN` nếu tích hợp dùng hai tên này.
3. Thêm `LDBC_ADMIN_PASSWORD`: mật khẩu riêng ít nhất 16 ký tự. Chỉ nhập ở Vercel; không ghi vào GitHub, HTML hoặc chat.
4. Triển khai lại sau khi đặt biến môi trường. Vào website → **Đăng nhập quản trị**. Khi thấy “Đã kết nối”, có thể cập nhật hồ sơ.
5. Dữ liệu trong file HTML cũ nằm trên trình duyệt riêng. Xuất JSON ở trang cũ rồi **Khôi phục** trên website sau khi đăng nhập. Nếu cùng địa chỉ website đã có dữ liệu cũ trong trình duyệt, dùng **Đưa bản cũ trên trình duyệt lên**. Kiểm tra số hồ sơ trước khi thay thế.

Danh sách ban đầu để trống. Mã nguồn GitHub không chứa dữ liệu thành viên. Đăng nhập rồi Khôi phục JSON của bạn để đưa thông tin và ảnh vào kho dữ liệu của website.

## Cách sử dụng hằng ngày

- Quản trị viên mở website, đăng nhập rồi nhập/sửa thông tin; bấm **Lưu thành viên**. Đợi trạng thái **Đã lưu trực tuyến** trước khi đóng trang.
- Thay ảnh nhanh, xóa hồ sơ, thêm từ nhập thông minh và khôi phục cũng tự đồng bộ.
- Ghi chú nội bộ lưu trong kho dữ liệu, chỉ gửi cho phiên đã đăng nhập; khách xem danh sách không nhận trường này.
- Sao lưu JSON định kỳ. Nếu hai thiết bị cùng sửa, hệ thống từ chối ghi đè phiên bản cũ; sao lưu bản đang sửa rồi tải bản mới để đối chiếu.
- Không cần xuất HTML hoặc triển khai lại sau mỗi lần sửa thông tin. Thay đổi mã nguồn vẫn triển khai qua GitHub/Vercel như bình thường.

## Giới hạn và vận hành

Chưa cấu hình đủ biến môi trường: danh sách vẫn xem được, nhưng không nhận ghi dữ liệu. Mất kết nối không được báo thành công. Mỗi danh sách tối đa 500 hồ sơ và 3 MB để nằm dưới giới hạn thân yêu cầu của máy chủ; ảnh đại diện được thu nhỏ tại trình duyệt. Có thể tăng quy mô bằng kho ảnh riêng trong lần nâng cấp sau.

Đăng nhập dùng cookie HttpOnly/Secure/SameSite, hết hạn sau 8 giờ. Mật khẩu đổi sẽ vô hiệu các phiên cũ. API kiểm tra nguồn yêu cầu, giới hạn lần đăng nhập và dùng cập nhật phiên bản nguyên tử để tránh mất dữ liệu khi hai nơi cùng sửa. Không đặt token Redis trong mã phía trình duyệt.

Nguồn tham khảo triển khai: [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [Upstash REST API](https://upstash.com/docs/redis/features/restapi).

Chạy kiểm tra: `npm test`.
