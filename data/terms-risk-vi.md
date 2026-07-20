# Điều Khoản & Công Bố Rủi Ro

Tài liệu này áp dụng cho website chính thức của PRANA Protocol và giao diện **PRANA Swap**. Vui lòng đọc kỹ trước khi kết nối ví hoặc xác nhận bất kỳ giao dịch nào.

## 1. Bản chất sản phẩm

PRANA Swap là giao diện kỹ thuật **non-custodial** (không lưu ký) phục vụ việc tương tác với các smart contract công khai trên blockchain Polygon.

PRANA Swap không tạo tài khoản giao dịch nội bộ hoặc số dư lưu ký cho người dùng.

Triết Học Đường Phố (**THĐP**):

- không lưu ký tài sản của người dùng
- không kiểm soát private key hoặc seed phrase
- không thể đảo ngược giao dịch đã được xác nhận on-chain

Token luôn nằm trong ví do bạn kiểm soát cho đến khi bạn tự ký và gửi giao dịch.

## 2. Điều kiện sử dụng

Người sử dụng phải có đầy đủ năng lực hành vi theo pháp luật áp dụng và đủ tuổi để tự mình xác lập giao dịch. Không được sử dụng PRANA Swap thay mặt người khác khi không có thẩm quyền hợp pháp.

## 3. Không phải tư vấn đầu tư

Thông tin trên website, trong thông báo sản phẩm và trên giao diện PRANA Swap chỉ nhằm giới thiệu công nghệ và cách sử dụng sản phẩm.

Nội dung này **không phải**:

- tư vấn đầu tư
- tư vấn pháp lý
- tư vấn thuế
- khuyến nghị tài chính dành riêng cho bất kỳ cá nhân nào

Bạn tự chịu trách nhiệm về mọi quyết định mua, bán, giữ hoặc swap tài sản.

## 4. Rủi ro chính

Tài sản mã hóa và các giao thức phi tập trung có thể phát sinh rủi ro, bao gồm nhưng không giới hạn:

- biến động giá mạnh trong thời gian ngắn
- thanh khoản thấp hoặc thay đổi đột ngột
- slippage và price impact
- lỗi, lỗ hổng hoặc hành vi ngoài dự kiến của smart contract
- sự cố mạng blockchain, tắc nghẽn hoặc phí gas bất thường
- mất quyền kiểm soát ví, phishing, malware hoặc lỗi thao tác của người dùng
- token giả mạo, địa chỉ contract giả hoặc giao diện giả mạo
- mất mát tài sản **không thể phục hồi**

Không có cam kết nào về giá, lợi nhuận, khả năng thanh khoản hoặc kết quả giao dịch.

## 5. Trách nhiệm của người dùng

Trước khi sử dụng, bạn có trách nhiệm:

- tự đánh giá rủi ro phù hợp với hoàn cảnh của mình
- kiểm tra toàn bộ thông tin giao dịch trên ví trước khi ký (token, số lượng, địa chỉ contract, mạng)
- xác nhận website đúng tên miền chính thức trước khi kết nối ví
- xác định việc sử dụng PRANA Swap có phù hợp với pháp luật áp dụng đối với quốc tịch, nơi cư trú và khu vực pháp lý của mình hay không

**Không sử dụng PRANA Swap** nếu hoạt động đó bị hạn chế hoặc bị cấm theo pháp luật áp dụng đối với bạn.

## 6. Địa chỉ smart contract cần đối chiếu

PRANA Swap dùng **Uniswap SwapRouter02** trên Polygon làm router thực thi swap:

[0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45](https://polygonscan.com/address/0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45#tokentxns)

Cách đối chiếu trên ví khác nhau giữa hai bước:

- **Approve (ERC-20):** trường `to` của giao dịch là **contract của token** bạn đang approve (ví dụ USDC, PRANA), không phải SwapRouter02. Địa chỉ cần đối chiếu là **spender** trong lời gọi `approve` phải là SwapRouter02 ở trên.
- **Swap:** trường `to` của giao dịch phải là SwapRouter02 ở trên.

Nếu ví hiển thị spender (khi approve) hoặc `to` (khi swap) khác địa chỉ trên, hãy dừng lại và không xác nhận giao dịch.

Giao diện quote phía máy chủ không phải contract mà bạn gửi token tới.

## 7. Approve đúng số lượng cần giao dịch

Với token ERC-20, bạn cần thực hiện bước **approve** trước khi swap nếu allowance chưa đủ.

PRANA Swap yêu cầu approve **đúng số lượng** của giao dịch hiện tại (không phải unlimited approval):

- Swap 100 USDC → approve 100 USDC
- Swap 50 PRANA → approve 50 PRANA

Mỗi lần số lượng swap thay đổi, bạn có thể cần approve lại. Cách tiếp cận này giới hạn quyền chi tiêu theo từng giao dịch.

Với **POL** (native token của Polygon), không cần approve ERC-20; giao dịch swap chỉ cần một lần xác nhận trên ví.

Nếu giao dịch swap thất bại, bị hủy hoặc không sử dụng hết allowance, quyền chi tiêu đã approve có thể vẫn còn tồn tại on-chain. Người dùng có thể kiểm tra và thu hồi allowance bằng công cụ phù hợp khi cần thiết.

## 8. Phí và chi phí

PRANA Swap **không thu** phí giao diện hay phí định tuyến riêng.

Bạn vẫn có thể phải trả các chi phí on-chain thông thường, ví dụ:

- gas mạng Polygon
- phí thanh khoản (LP fee) của pool Uniswap được sử dụng
- price impact khi quy mô giao dịch lớn so với thanh khoản

Pool WBTC/PRANA hiện dùng phí LP **1%**. THĐP đã cung cấp thanh khoản cho pool này từ giai đoạn khởi đầu của hệ sinh thái PRANA; điều đó không loại trừ rủi ro thanh khoản hoặc biến động giá.

Một giao dịch có thể được định tuyến qua nhiều pool. Trong trường hợp đó, tỷ giá quote đã phản ánh tác động tổng hợp của các pool và phí thanh khoản tương ứng. Price impact và slippage không phải là khoản phí do THĐP thu.

## 9. Phạm vi kỹ thuật hiện tại

Trong phiên bản hiện tại, PRANA Swap:

- chỉ hoạt động trên **Polygon mainnet**
- hỗ trợ allowlist cố định gồm 7 token: **PRANA, WBTC, POL, USDC, USDT, WETH, DAI**
- dùng slippage cố định **0,5%** trên giao diện
- gửi giao dịch qua Uniswap SwapRouter02 như nêu ở mục 6
- yêu cầu ví injected (ví dụ MetaMask, Rabby); bạn phải tự ký mọi giao dịch

Người dùng có thể swap giữa các token trong danh sách, không bắt buộc cặp giao dịch phải có PRANA.

## 10. Dịch vụ bên thứ ba

PRANA Swap phụ thuộc vào Polygon, Uniswap, ví, RPC provider và các hạ tầng bên thứ ba. THĐP không sở hữu hoặc kiểm soát toàn bộ các hệ thống này. Việc sử dụng chúng có thể đồng thời chịu điều khoản riêng của từng bên.

## 11. Dữ liệu và quyền riêng tư

Chi tiết về dữ liệu kỹ thuật có thể được xử lý khi bạn dùng website hoặc PRANA Swap (ví dụ log vận hành, địa chỉ ví trong request quote/swap, và access log của hạ tầng) được mô tả tại [Chính sách quyền riêng tư](/privacy).

## 12. Không đảm bảo liên tục và không bồi thường

PRANA Swap được cung cấp trên cơ sở “nguyên trạng” và “tùy khả năng sẵn có”, không bảo đảm hoạt động liên tục, không có lỗi hoặc luôn tương thích với mọi ví và thiết bị.

Trong phạm vi tối đa được pháp luật áp dụng cho phép, THĐP và các bên liên quan không chịu trách nhiệm đối với thiệt hại phát sinh từ việc sử dụng hoặc không thể sử dụng PRANA Swap, bao gồm sự cố blockchain, smart contract bên thứ ba, ví, RPC, dữ liệu quote hoặc giao dịch do người dùng ký.

Điều khoản này không loại trừ hoặc hạn chế những trách nhiệm mà pháp luật áp dụng không cho phép loại trừ hoặc hạn chế.

## 13. Cập nhật điều khoản

THĐP có thể cập nhật tài liệu này theo thời gian để phản ánh thay đổi sản phẩm hoặc yêu cầu pháp lý. Phiên bản đăng trên website chính thức tại đường dẫn `/terms` là phiên bản hiện hành.

Việc tiếp tục sử dụng website hoặc PRANA Swap sau khi điều khoản được cập nhật đồng nghĩa với việc bạn chấp nhận phiên bản mới, trong phạm vi pháp luật áp dụng cho phép.

## 14. Liên hệ thực tế khi dùng sản phẩm

Trước mỗi giao dịch:

1. Kiểm tra đúng tên miền website chính thức
2. Kiểm tra mạng ví đang ở Polygon
3. Đối chiếu đúng địa chỉ ở mục 6: spender khi approve, `to` khi swap
4. Đọc kỹ số lượng token in/out và mức tối thiểu nhận được trên ví
5. Chỉ xác nhận khi bạn hiểu và chấp nhận rủi ro

Nếu bạn không đồng ý với các điều khoản và rủi ro trong tài liệu này, vui lòng không kết nối ví và không sử dụng PRANA Swap.
