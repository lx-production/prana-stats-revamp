# Điều Khoản & Công Bố Rủi Ro

Tài liệu này áp dụng cho website chính thức của PRANA Protocol và giao diện **PRANA Swap**. Vui lòng đọc kỹ trước khi kết nối ví hoặc xác nhận bất kỳ giao dịch nào.

## 1. Bản chất sản phẩm

PRANA Swap là giao diện kỹ thuật **non-custodial** (không lưu ký) phục vụ việc tương tác với các smart contract công khai trên blockchain Polygon.

Triết Học Đường Phố (**THĐP**):

- không lưu ký tài sản của người dùng
- không kiểm soát private key hoặc seed phrase
- không thể đảo ngược giao dịch đã được xác nhận on-chain
- không vận hành PRANA Swap như một sàn giao dịch tập trung (CEX)

Token luôn nằm trong ví do bạn kiểm soát cho đến khi bạn tự ký và gửi giao dịch.

## 2. Không phải tư vấn đầu tư

Thông tin trên website, trong thông báo sản phẩm và trên giao diện PRANA Swap chỉ nhằm giới thiệu công nghệ và cách sử dụng sản phẩm.

Nội dung này **không phải**:

- tư vấn đầu tư
- tư vấn pháp lý
- tư vấn thuế
- khuyến nghị tài chính dành riêng cho bất kỳ cá nhân nào

Bạn tự chịu trách nhiệm về mọi quyết định mua, bán, giữ hoặc swap tài sản.

## 3. Rủi ro chính

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

## 4. Trách nhiệm của người dùng

Trước khi sử dụng, bạn có trách nhiệm:

- tự đánh giá rủi ro phù hợp với hoàn cảnh của mình
- kiểm tra toàn bộ thông tin giao dịch trên ví trước khi ký (token, số lượng, địa chỉ contract, mạng)
- xác nhận website đúng tên miền chính thức trước khi kết nối ví
- xác định việc sử dụng PRANA Swap có phù hợp với pháp luật áp dụng đối với quốc tịch, nơi cư trú và khu vực pháp lý của mình hay không

**Không sử dụng PRANA Swap** nếu hoạt động đó bị hạn chế hoặc bị cấm theo pháp luật áp dụng đối với bạn.

## 5. Địa chỉ smart contract cần đối chiếu

Khi approve hoặc swap token ERC-20, ví sẽ yêu cầu bạn ký tương tác với **Uniswap SwapRouter02** trên Polygon. Đây là địa chỉ duy nhất dùng cho cả bước approve (spender) và bước swap (`to`):

`0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`

Nếu ví hiển thị địa chỉ spender/`to` khác địa chỉ trên, hãy dừng lại và không xác nhận giao dịch.

Giao diện quote phía máy chủ không phải contract mà bạn gửi token tới. Người dùng chỉ cần đối chiếu SwapRouter02 khi ký approve và swap.

## 6. Approve đúng số lượng cần giao dịch

Với token ERC-20, bạn cần thực hiện bước **approve** trước khi swap nếu allowance chưa đủ.

PRANA Swap yêu cầu approve **đúng số lượng** của giao dịch hiện tại (không phải unlimited approval):

- Swap 100 USDC → approve 100 USDC
- Swap 50 PRANA → approve 50 PRANA

Mỗi lần số lượng swap thay đổi, bạn có thể cần approve lại. Cách tiếp cận này giới hạn quyền chi tiêu theo từng giao dịch.

Với **POL** (native token của Polygon), không cần approve ERC-20; giao dịch swap chỉ cần một lần xác nhận trên ví.

## 7. Phí và chi phí

PRANA Swap **không thu** phí giao diện hay phí định tuyến riêng.

Bạn vẫn có thể phải trả các chi phí on-chain thông thường, ví dụ:

- gas mạng Polygon
- phí thanh khoản (LP fee) của pool Uniswap được sử dụng
- price impact khi quy mô giao dịch lớn so với thanh khoản

Pool WBTC/PRANA hiện dùng phí LP **1%**. THĐP đã cung cấp thanh khoản cho pool này từ giai đoạn khởi đầu của hệ sinh thái PRANA; điều đó không loại trừ rủi ro thanh khoản hoặc biến động giá.

## 8. Phạm vi kỹ thuật hiện tại

Trong phiên bản hiện tại, PRANA Swap:

- chỉ hoạt động trên **Polygon mainnet**
- hỗ trợ allowlist cố định gồm 7 token: **PRANA, WBTC, POL, USDC, USDT, WETH, DAI**
- dùng slippage cố định **0,5%** trên giao diện
- gửi giao dịch qua Uniswap SwapRouter02 như nêu ở mục 5
- yêu cầu ví injected (ví dụ MetaMask, Rabby); bạn phải tự ký mọi giao dịch

Người dùng có thể swap giữa các token trong danh sách, không bắt buộc cặp giao dịch phải có PRANA.

## 9. PRANA Swap không phải là gì

PRANA Swap **không phải**:

- sàn giao dịch tập trung (CEX)
- nơi yêu cầu đăng ký tài khoản hoặc xác minh danh tính (KYC) do THĐP vận hành
- dịch vụ lưu ký hoặc ví do THĐP giữ hộ
- bảo hiểm, bảo lãnh lợi nhuận, hoặc cam kết giá / thanh khoản

Mọi quyết định giao dịch cuối cùng đều cần bạn trực tiếp ký xác nhận trên ví do chính bạn kiểm soát.

## 10. Không đảm bảo liên tục và không bồi thường

Website, API quote và giao diện có thể bị gián đoạn, chậm, lỗi hiển thị hoặc thay đổi mà không cần thông báo trước.

Trong phạm vi pháp luật cho phép, THĐP và các bên liên quan không chịu trách nhiệm đối với thiệt hại trực tiếp hoặc gián tiếp phát sinh từ việc sử dụng hoặc không thể sử dụng PRANA Swap, bao gồm mất mát tài sản do giao dịch on-chain, lỗi mạng, lỗi ví, hoặc quyết định của người dùng.

## 11. Cập nhật điều khoản

THĐP có thể cập nhật tài liệu này theo thời gian để phản ánh thay đổi sản phẩm hoặc yêu cầu pháp lý. Phiên bản đăng trên website chính thức tại đường dẫn `/terms` là phiên bản hiện hành.

Việc tiếp tục sử dụng website hoặc PRANA Swap sau khi điều khoản được cập nhật đồng nghĩa với việc bạn chấp nhận phiên bản mới, trong phạm vi pháp luật áp dụng cho phép.

## 12. Liên hệ thực tế khi dùng sản phẩm

Trước mỗi giao dịch:

1. Kiểm tra đúng tên miền website chính thức
2. Kiểm tra mạng ví đang ở Polygon
3. Đối chiếu địa chỉ SwapRouter02 ở mục 5
4. Đọc kỹ số lượng token in/out và mức tối thiểu nhận được trên ví
5. Chỉ xác nhận khi bạn hiểu và chấp nhận rủi ro

Nếu bạn không đồng ý với các điều khoản và rủi ro trong tài liệu này, vui lòng không kết nối ví và không sử dụng PRANA Swap.
