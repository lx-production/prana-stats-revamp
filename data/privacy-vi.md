# Chính sách quyền riêng tư

Tài liệu này mô tả dữ liệu kỹ thuật có thể được xử lý khi bạn truy cập website chính thức của PRANA Protocol hoặc dùng giao diện **PRANA Swap**. Đọc cùng với [Điều khoản & Công bố rủi ro](/terms).

## 1. Phạm vi

Chính sách này áp dụng cho website và PRANA Swap do THĐP vận hành trên tên miền chính thức. Nó không bao gồm điều khoản riêng của ví, RPC, Uniswap, Polygon hoặc nhà cung cấp hạ tầng khác.

## 2. Dữ liệu có thể được ghi nhận

Website **không** tuyên bố “không thu thập dữ liệu”. Trong thực tế vận hành, các dữ liệu sau có thể được xử lý:

**Log vận hành phía máy chủ (PRANA Swap)**

- địa chỉ IP của client (dùng cho rate limit và ghi log)
- `User-Agent`, host/origin của request
- địa chỉ ví khi có trong request (ví dụ `recipient` khi lấy quote, `ownerAddress` trong log vòng đời giao dịch)
- dữ liệu quote và giao dịch mang tính kỹ thuật: cặp token, số lượng, slippage, route, lỗi, và transaction hash khi có

**Access log của hạ tầng**

- máy chủ ứng dụng, reverse proxy hoặc CDN (nếu dùng) có thể ghi access log kỹ thuật theo cấu hình mặc định của hạ tầng (IP, đường dẫn, thời điểm, mã phản hồi, v.v.)

**Trình duyệt (local)**

- lựa chọn ngôn ngữ giao diện (`vi` / `en`) lưu trong `localStorage` trên thiết bị của bạn

## 3. Những gì hiện không dùng

Ở phiên bản hiện tại:

- không tích hợp dịch vụ analytics marketing bên thứ ba (ví dụ Google Analytics)
- không gắn cookie theo dõi quảng cáo
- không tạo tài khoản người dùng nội bộ và không lưu số dư giao dịch của bạn trên hệ thống của THĐP

## 4. Mục đích xử lý

Dữ liệu trên được dùng để vận hành dịch vụ, bảo mật, chống lạm dụng (rate limit), gỡ lỗi và theo dõi sự cố kỹ thuật — không nhằm mục đích bán dữ liệu cá nhân.

## 5. Lưu trữ và bên thứ ba

Log có thể nằm trên máy chủ hoặc hạ tầng mà THĐP sử dụng để chạy website. Khi request đi qua RPC, ví hoặc mạng blockchain, các bên đó có thể tự xử lý dữ liệu theo điều khoản riêng của họ. Xem thêm mục dịch vụ bên thứ ba trong [Điều khoản](/terms).

## 6. Cập nhật

THĐP có thể cập nhật trang này khi cách thu thập hoặc xử lý dữ liệu thay đổi. Bản đăng tại `/privacy` là bản hiện hành.
