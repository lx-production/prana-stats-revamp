# Chính sách quyền riêng tư

Chính sách quyền riêng tư này giải thích cách dữ liệu kỹ thuật có thể được xử lý khi bạn truy cập website chính thức của PRANA Protocol hoặc dùng **PRANA Swap** hoặc **PRANA Staking** (gọi chung là **Giao diện PRANA**). Đọc cùng với [Điều khoản & Công bố rủi ro](/terms).

## 1. Phạm vi và bên vận hành

Chính sách này áp dụng cho website và Giao diện PRANA do Triết Học Đường Phố (**THĐP**) vận hành trên tên miền chính thức.

Nó bao gồm dữ liệu được xử lý bởi website và máy chủ ứng dụng do THĐP vận hành. Nó không thay thế chính sách quyền riêng tư hoặc điều khoản của ví, Polygon, Uniswap, nhà cung cấp RPC, nhà cung cấp hosting, block explorer, hoặc các bên thứ ba độc lập khác.

Câu hỏi hoặc yêu cầu về quyền riêng tư có thể gửi tới [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net).

## 2. Lưu ý quan trọng về quyền riêng tư trên blockchain

Blockchain công khai là minh bạch. Khi bạn gửi một giao dịch, các thông tin như địa chỉ ví, số lượng token, tương tác contract, mã băm giao dịch, trạng thái, và timestamp trở thành công khai trên Polygon.

Dữ liệu blockchain công khai có thể tồn tại vĩnh viễn và có thể bị bất kỳ ai sao chép, lập chỉ mục, phân tích, hoặc liên kết với thông tin khác. THĐP không kiểm soát Polygon và nhìn chung không thể chỉnh sửa hoặc xóa các bản ghi blockchain đã được xác nhận.

Việc dùng địa chỉ ví mới không bảo đảm tính ẩn danh.

## 3. Dữ liệu được xử lý khi bạn truy cập website

Website **không** tuyên bố rằng không có dữ liệu nào được thu thập. Tùy theo request và cấu hình hạ tầng, các dữ liệu kỹ thuật sau có thể được xử lý:

- địa chỉ IP của client
- ngày và giờ của request
- host, đường dẫn, và tham số query được yêu cầu
- origin hoặc referrer của request khi trình duyệt cung cấp
- `User-Agent` của trình duyệt hoặc client
- mã trạng thái phản hồi, kích thước request, và các trường chẩn đoán tương tự
- thông tin bảo mật và rate-limit

Máy chủ ứng dụng, reverse proxy, nhà cung cấp hosting, hoặc CDN có thể tạo access log hoặc error log chứa một phần thông tin này.

Ngôn ngữ giao diện đã chọn (`vi` hoặc `en`) được lưu trong `localStorage` trên thiết bị của bạn.

## 4. Dữ liệu được xử lý bởi PRANA Swap

Để tạo quote, vận hành luồng giao dịch, ngăn lạm dụng, xử lý sự cố, và xác minh một swap thành công được báo cáo, dịch vụ Swap có thể xử lý:

- địa chỉ ví dùng làm người nhận quote hoặc chủ giao dịch
- ký hiệu token đầu vào và đầu ra cùng các định danh liên quan đến contract
- số lượng đầu vào, output theo quote, output thô, và output tối thiểu
- mức slippage, tuyến đường đã chọn, các pool hoặc protocol trong tuyến đường, và địa chỉ router
- gas ước tính và thông tin khối liên quan
- các sự kiện vòng đời approve và swap
- mã băm giao dịch và trạng thái receipt khi có
- lỗi đã được làm sạch liên quan đến ví, nhà cung cấp, quote, định tuyến, hoặc giao dịch
- dữ liệu request và access được mô tả ở mục 3

Khi trình duyệt báo cáo một swap đã xác nhận, máy chủ ứng dụng có thể lấy giao dịch và receipt công khai trên Polygon để đối chiếu người gửi, contract đích, calldata, value, và trạng thái thành công với quote đã phát hành. Các sự kiện Swap đã xác minh và chưa xác minh có thể được ghi trong log vận hành.

## 5. Dữ liệu được xử lý bởi PRANA Staking

Sau khi bạn kết nối ví, giao diện Staking yêu cầu snapshot tài khoản theo từng ví từ máy chủ ứng dụng của THĐP. Request chứa địa chỉ ví công khai của bạn. Máy chủ dùng địa chỉ đó để đọc dữ liệu Polygon công khai, bao gồm:

- số dư PRANA
- nonce Permit của PRANA
- các bản ghi stake hiện tại
- định danh stake, số lượng, thời điểm bắt đầu, thời hạn, APR, và thời điểm claim gần nhất
- số khối và timestamp khối liên quan

Địa chỉ ví cũng có thể xuất hiện trong URL của request và do đó có thể xuất hiện trong log ứng dụng, reverse-proxy, hosting, hoặc access log, tùy cấu hình hạ tầng. Các request tài khoản Staking được rate-limit bằng địa chỉ IP của client.

Trong phiên bản hiện tại, giao diện Staking không gửi một luồng telemetry vòng đời staking riêng tới máy chủ ứng dụng của THĐP. Chữ ký Permit được tạo trong ví của bạn, và các giao dịch Stake, Claim, Unstake, và Early Unstake được gửi từ trình duyệt hoặc ví của bạn tới hạ tầng Polygon.

Các nhà cung cấp ví và blockchain đó có thể độc lập nhận hoặc xử lý địa chỉ IP, địa chỉ ví, request đã ký, dữ liệu giao dịch, và thông tin kỹ thuật khác theo chính sách riêng của họ.

## 6. Dữ liệu ví và thiết bị

Để hiển thị và thực hiện các hành động được yêu cầu, giao diện trình duyệt có thể tạm thời xử lý:

- địa chỉ ví đã kết nối
- chain hiện tại và trạng thái kết nối
- số dư, allowance, nonce, stake, và dữ liệu giao dịch công khai
- quote và dữ liệu nhập trên form
- các thành phần chữ ký Permit và mã băm giao dịch đang chờ
- lỗi ví hoặc RPC

Dữ liệu này có thể tồn tại trong bộ nhớ trình duyệt khi bạn dùng giao diện. Tiện ích mở rộng hoặc ứng dụng ví của bạn có thể lưu dữ liệu kết nối hoặc hoạt động riêng một cách độc lập.

THĐP không yêu cầu, nhận, hoặc lưu trữ seed phrase hay private key của bạn qua Giao diện PRANA. Không bao giờ nhập cả hai vào website hoặc gửi cho bất kỳ ai tự nhận hỗ trợ PRANA.

## 7. Những gì không được dùng trong phiên bản hiện tại

Website và Giao diện PRANA hiện tại không dùng:

- analytics marketing bên thứ ba như Google Analytics
- cookie theo dõi quảng cáo
- quảng cáo theo hành vi hoặc bán dữ liệu cá nhân
- tài khoản người dùng nội bộ
- số dư ví lưu ký do THĐP duy trì

Điều này không có nghĩa là không có dữ liệu kỹ thuật hoặc dữ liệu blockchain công khai nào được xử lý. Các mục 2 đến 6 mô tả các luồng dữ liệu thực sự tồn tại.

## 8. Mục đích xử lý

THĐP có thể xử lý dữ liệu mô tả ở trên để:

- cung cấp trang website, quote Swap, và dữ liệu tài khoản Staking mà bạn yêu cầu
- xây dựng, xác thực, và xác minh các luồng giao dịch kỹ thuật
- duy trì bảo mật, rate-limit request, và ngăn lạm dụng
- phát hiện, chẩn đoán, và khắc phục lỗi hoặc sự cố sẵn sàng
- theo dõi hiệu năng dịch vụ và độ tin cậy của luồng giao dịch
- điều tra nghi ngờ lạm dụng hoặc sự cố bảo mật
- tuân thủ pháp luật áp dụng hoặc yêu cầu pháp lý hợp lệ
- xác lập, thực hiện, hoặc bảo vệ các khiếu nại pháp lý

THĐP không dùng dữ liệu này để lưu ký tài sản của bạn hoặc đưa ra quyết định đầu tư tự động thay bạn.

Khi pháp luật áp dụng yêu cầu cơ sở pháp lý, việc xử lý có thể dựa trên việc cung cấp dịch vụ bạn yêu cầu, lợi ích hợp pháp của THĐP trong việc vận hành và bảo mật dịch vụ, tuân thủ nghĩa vụ pháp lý, hoặc sự đồng ý khi cần sự đồng ý.

## 9. Chia sẻ và nhà cung cấp dịch vụ

Dữ liệu có thể được tiết lộ hoặc cung cấp cho:

- nhà cung cấp hạ tầng, hosting, reverse-proxy, CDN, bảo mật, và dịch vụ kỹ thuật dùng để vận hành website
- nhà cung cấp RPC và hạ tầng blockchain dùng để đọc Polygon hoặc gửi và xác nhận giao dịch
- nhà cung cấp ví và ứng dụng mà bạn chọn dùng
- Uniswap và các protocol khác tham gia tuyến đường Swap
- block explorer và các dịch vụ khác lập chỉ mục dữ liệu blockchain công khai
- cố vấn chuyên môn, kiểm toán viên, hoặc nhà cung cấp ứng phó sự cố khi hợp lý cần thiết
- cơ quan công quyền hoặc các bên khác khi pháp luật yêu cầu hoặc khi cần thiết để bảo vệ quyền, an toàn, và bảo mật
- bên vận hành kế nhiệm trong trường hợp tái tổ chức, chuyển giao, hoặc tiếp tục dịch vụ, tùy theo pháp luật áp dụng

Các bên nhận này có thể xử lý dữ liệu theo điều khoản và chính sách quyền riêng tư riêng của họ. Dữ liệu on-chain công khai sẵn có cho bất kỳ ai mà không cần THĐP chọn bên nhận.

## 10. Thời gian lưu trữ

Log vận hành, bảo mật, và hạ tầng chỉ được giữ trong thời gian hợp lý cần thiết cho các mục đích mô tả trong chính sách này, có xét đến nhu cầu bảo mật, xử lý sự cố, lịch backup và xoay vòng log, nghĩa vụ pháp lý, và nhu cầu giải quyết tranh chấp.

Các nhà cung cấp hạ tầng khác nhau có thể áp dụng thời gian lưu trữ khác nhau theo chính sách riêng của họ. Bản ghi blockchain công khai được blockchain và các bên lập chỉ mục bên thứ ba giữ độc lập với THĐP và có thể thực chất là vĩnh viễn.

Khi dữ liệu không còn cần thiết một cách hợp lý, THĐP sẽ xóa, ghi đè, hoặc hủy định danh dữ liệu đó trong phạm vi thực tế hợp lý và tùy theo pháp luật áp dụng.

## 11. Bảo mật

THĐP dùng các biện pháp kỹ thuật và tổ chức hợp lý nhằm bảo vệ dữ liệu ứng dụng khỏi truy cập trái phép, mất mát, sử dụng sai mục đích, hoặc thay đổi. Không có dịch vụ internet, ví, RPC, hoặc hệ thống blockchain nào hoàn toàn an toàn, và THĐP không thể bảo đảm bảo mật tuyệt đối.

Bạn có trách nhiệm bảo vệ ví, thiết bị, private key, seed phrase, và phương thức khôi phục của mình.

## 12. Lựa chọn và quyền của bạn

Bạn có thể:

- duyệt các phần công khai của website mà không kết nối ví
- ngắt kết nối ví qua ví hoặc giao diện
- từ chối yêu cầu chữ ký hoặc giao dịch
- xóa lựa chọn ngôn ngữ đã lưu qua phần kiểm soát dữ liệu trang web của trình duyệt
- dùng công cụ tương thích khác để đọc hoặc tương tác với các contract công khai

Tùy pháp luật áp dụng, bạn có thể có quyền yêu cầu thông tin về, truy cập, sửa, xóa, hạn chế, hoặc phản đối một số việc xử lý dữ liệu cá nhân của mình, và rút lại sự đồng ý khi việc xử lý dựa trên sự đồng ý.

Để gửi yêu cầu, hãy email [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net). THĐP có thể cần đủ thông tin để xác minh yêu cầu và xác định các bản ghi liên quan. Một số yêu cầu có thể bị hạn chế bởi pháp luật áp dụng, nhu cầu bảo mật, quyền của người khác, hoặc ràng buộc kỹ thuật.

THĐP không thể xóa hoặc thay đổi dữ liệu đã ghi trên Polygon hoặc do bên thứ ba giữ độc lập.

## 13. Xử lý xuyên biên giới

Hạ tầng internet, hosting, ví, RPC, và blockchain có thể vận hành ở nhiều quốc gia. Do đó, dữ liệu kỹ thuật hoặc dữ liệu blockchain công khai của bạn có thể được xử lý ngoài quốc gia nơi bạn sinh sống. Khi được yêu cầu, THĐP sẽ áp dụng các biện pháp mà pháp luật áp dụng đòi hỏi đối với xử lý xuyên biên giới.

## 14. Trẻ em

Giao diện PRANA không hướng tới trẻ em hoặc người thiếu năng lực pháp lý để thực hiện các giao dịch liên quan. Nếu bạn tin rằng một trẻ em đã cung cấp dữ liệu cá nhân cho THĐP qua website, hãy liên hệ [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net).

## 15. Thay đổi chính sách này

THĐP có thể cập nhật chính sách này khi website, luồng dữ liệu, nhà cung cấp dịch vụ, hoặc yêu cầu pháp lý thay đổi. Phiên bản đăng tại `/privacy` là phiên bản hiện hành.

Các thay đổi trọng yếu nên được xem lại trước khi bạn tiếp tục dùng Giao diện PRANA.
