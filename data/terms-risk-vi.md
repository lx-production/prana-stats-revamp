# Điều Khoản & Công Bố Rủi Ro

Tài liệu này áp dụng cho website chính thức của PRANA Protocol và các giao diện giao dịch của website, bao gồm **PRANA Swap** và **PRANA Staking** (gọi chung là **Giao diện PRANA**). Vui lòng đọc kỹ trước khi kết nối ví, ký thông điệp, hoặc xác nhận giao dịch.

Khi sử dụng một Giao diện PRANA, bạn xác nhận rằng bạn đã hiểu và chấp nhận các điều khoản này cùng các rủi ro được mô tả dưới đây. Nếu bạn không đồng ý, vui lòng không sử dụng Giao diện PRANA.

## 1. Bản chất của Giao diện PRANA

Giao diện PRANA là các giao diện kỹ thuật, **non-custodial** (không lưu ký), giúp người dùng tương tác với các smart contract công khai trên blockchain Polygon.

Triết Học Đường Phố (**THĐP**):

- không tạo tài khoản giao dịch hoặc staking nội bộ cho bạn
- không kiểm soát ví, private key, hoặc seed phrase của bạn
- không thể ký giao dịch thay bạn
- không thể đảo ngược, hủy, hoặc khôi phục giao dịch sau khi giao dịch đã được xác nhận on-chain

Bạn vẫn kiểm soát ví của mình. Tuy nhiên, khi bạn stake PRANA, số dư gốc được stake sẽ được chuyển từ ví của bạn sang Staking Contract và sau đó chịu sự điều chỉnh của contract đó cho đến khi được trả lại theo quy tắc của contract.

Smart contract không giống tài khoản ngân hàng hoặc tài khoản lưu ký. Tài sản nằm trong smart contract có thể chịu rủi ro từ contract, blockchain, cấu hình, và vận hành.

## 2. Điều kiện đủ tư cách và sử dụng hợp pháp

Bạn phải có đầy đủ năng lực hành vi theo pháp luật áp dụng và đủ tuổi để tự mình xác lập giao dịch. Bạn không được sử dụng Giao diện PRANA thay mặt người khác khi không có thẩm quyền hợp pháp.

Bạn có trách nhiệm tự xác định xem việc sử dụng PRANA, swap, staking, và Giao diện PRANA có hợp pháp theo quốc tịch, nơi cư trú, và khu vực pháp lý của mình hay không.

**Không sử dụng Giao diện PRANA** nếu việc sử dụng đó bị hạn chế hoặc bị cấm theo pháp luật áp dụng.

## 3. Không phải tư vấn đầu tư, pháp lý, hoặc thuế

Thông tin trên website, trong thông báo sản phẩm, và trên Giao diện PRANA chỉ nhằm mô tả PRANA Protocol, dữ liệu công khai của protocol, và các tương tác kỹ thuật sẵn có.

Thông tin này **không phải**:

- tư vấn đầu tư hoặc tư vấn tài chính
- tư vấn pháp lý
- tư vấn thuế
- khuyến nghị hoặc bảo đảm dành cho bất kỳ cá nhân nào

Bạn tự chịu trách nhiệm quyết định có mua, bán, giữ, swap, stake, claim, hoặc unstake tài sản mã hóa hay không. Bạn nên tham vấn chuyên gia độc lập khi thích hợp.

## 4. Rủi ro chung của tài sản mã hóa và blockchain

Tài sản mã hóa và các giao thức phi tập trung liên quan đến rủi ro đáng kể, bao gồm nhưng không giới hạn:

- biến động giá mạnh và mất giá trị thị trường
- thanh khoản mỏng, không sẵn có, hoặc thay đổi đột ngột
- lỗi, lỗ hổng, khai thác, hoặc hành vi ngoài dự kiến của smart contract
- tái tổ chức blockchain, sự cố, tắc nghẽn, xác nhận chậm, hoặc phí gas bất thường
- dữ liệu sai, chậm, cũ, hoặc không sẵn có từ RPC hoặc các nhà cung cấp hạ tầng khác
- bị chiếm quyền ví, phishing, malware, phê duyệt độc hại, hoặc lỗi thao tác của người dùng
- token giả, địa chỉ contract giả mạo, website giả danh, hoặc giao diện bị chỉnh sửa
- thay đổi về quy định, thuế, hoặc pháp lý
- giao dịch hoặc mất mát tài sản không thể đảo ngược hoặc khôi phục

Không có bảo đảm nào về giá, lợi nhuận, lợi suất, thanh khoản, thu hồi gốc, thanh toán lãi, hoặc kết quả giao dịch.

## 5. Tóm tắt PRANA Swap và rủi ro riêng

PRANA Swap giúp người dùng yêu cầu tuyến đường và gửi giao dịch swap qua các smart contract Uniswap trên Polygon. Trong giao diện hiện tại:

- swap được thực thi qua Uniswap SwapRouter02
- các tài sản được hỗ trợ do giao diện lựa chọn
- giao diện dùng mức slippage cố định
- swap ERC-20 có thể cần một giao dịch approve riêng
- swap POL native không cần approve ERC-20

Quote swap chỉ là ước tính, không phải bảo đảm. Kết quả cuối cùng có thể khác hoặc giao dịch có thể thất bại vì slippage, biến động giá, thay đổi thanh khoản, ước tính gas, định tuyến, hành vi token, MEV, điều kiện blockchain, hoặc sự cố bên thứ ba.

Đối với swap ERC-20, PRANA Swap hiện yêu cầu approve đúng số lượng đầu vào, không phải unlimited approval. Allowance chưa dùng hoặc dùng một phần vẫn có thể còn tồn tại on-chain sau khi swap bị hủy hoặc thất bại. Bạn có trách nhiệm kiểm tra và thu hồi allowance khi thích hợp.

PRANA Swap hiện không thu phí giao diện hoặc phí định tuyến riêng. Bạn vẫn có thể phải trả:

- gas mạng Polygon
- phí nhà cung cấp thanh khoản trong các pool mà tuyến đường sử dụng
- price impact và slippage

Pool WBTC/PRANA hiện dùng phí nhà cung cấp thanh khoản 1%, và THĐP đã cung cấp thanh khoản cho pool đó. Điều này không loại trừ rủi ro về giá, thanh khoản, xung đột lợi ích, hoặc mất mát. Một tuyến đường có thể dùng nhiều hơn một pool, và quote có thể phản ánh nhiều khoản phí pool.

## 6. Tóm tắt PRANA Staking và rủi ro riêng

PRANA Staking giúp người dùng tạo và quản lý các vị thế stake PRANA qua Staking Contract trên Polygon.

**Cách tạo một vị thế stake**

Giao diện dùng chữ ký EIP-2612 Permit cho đúng số lượng PRANA, sau đó gửi giao dịch `stakeWithPermit`. Chữ ký Permit diễn ra off-chain, nhưng giao dịch Stake là on-chain và cần một lần xác nhận ví riêng. Vì vậy, một nút “Permit & Stake” có thể kích hoạt hai lời nhắc trên ví.

Khi giao dịch Stake thành công:

- số dư gốc PRANA đã chọn được chuyển vào Staking Contract
- thời hạn và APR của vị thế đó được ghi nhận on-chain
- số dư gốc bị khóa đến khi đáo hạn, trừ khi bạn dùng early unstake

Chữ ký Permit là một ủy quyền. Hãy đọc spender, token, số lượng, chain, nonce, và deadline mà ví hiển thị trước khi ký. Từ chối chữ ký nếu bất kỳ chi tiết nào bất thường.

**APR và lãi**

APR là tỷ lệ quy năm mà contract dùng để tính lãi denominated bằng PRANA. Đó không phải bảo đảm về giá trị fiat, lợi nhuận thị trường, sức mua, hoặc lợi nhuận.

Lãi dự kiến hoặc lãi đã tích lũy được hiển thị chỉ là ước tính dựa trên dữ liệu contract công khai và công thức làm tròn số nguyên của contract. Số lượng cuối cùng on-chain có thể hơi khác vì timestamp khối, làm tròn số nguyên, thay đổi cấu hình, hoặc dữ liệu giao diện cũ.

Việc thanh toán lãi phụ thuộc vào Interest Contract còn đủ PRANA và hoạt động đúng như kỳ vọng. Một giao dịch claim có thể thất bại nếu contract bị tạm dừng, Interest Contract không đủ quỹ, mạng hoặc RPC không sẵn có, hoặc lời gọi contract bị revert vì lý do khác. THĐP không bảo đảm mọi khoản lãi dự kiến sẽ sẵn có hoặc được thanh toán thành công.

**Claim, đáo hạn, và thời gian ân hạn**

Lãi chỉ tích lũy theo quy tắc của Staking Contract. Bạn có thể claim lãi đủ điều kiện khi vị thế còn hiệu lực và, sau đáo hạn, chỉ đến khi thời gian ân hạn áp dụng kết thúc.

Nếu bạn unstake một vị thế đã đáo hạn trước khi claim phần lãi còn đủ điều kiện, bản ghi stake sẽ bị xóa và phần lãi chưa claim đó có thể bị mất. Vì vậy, giao diện chính thức yêu cầu bạn claim lãi đủ điều kiện trước khi unstake trong thời gian ân hạn.

Sau khi thời gian ân hạn kết thúc, lãi chưa claim không còn được claim nữa, dù số dư gốc vẫn có thể đủ điều kiện unstake theo quy tắc contract. Bạn có trách nhiệm theo dõi đáo hạn và claim đúng hạn.

**Early unstake**

Early unstake trả lại ít hơn số dư gốc ban đầu:

- mức phạt early-unstake đã cấu hình được trừ vào gốc
- toàn bộ lãi đã tích lũy nhưng chưa claim của vị thế đó bị mất
- khoản phạt được Staking Contract chuyển sang Interest Contract
- bạn cũng phải trả gas Polygon

Phạt early-unstake là quy tắc của smart contract, không phải phí giao diện riêng do THĐP thu. Hãy xem tỷ lệ phần trăm và số nhận ước tính đang hiển thị trước khi xác nhận.

**Kiểm soát cấu hình và quản trị**

Staking Contract có các hàm do owner kiểm soát. Trong phạm vi contract đã triển khai cho phép, owner có thể tạm dừng các hành động của contract và thay đổi các APR sẵn có, mức stake tối thiểu, thời gian ân hạn, và phạt early-unstake.

APR được lưu cho một vị thế stake hiện hữu được xác định tại thời điểm tạo vị thế đó. Các thiết lập toàn cục khác và trạng thái tạm dừng có thể ảnh hưởng đến các hành động thực hiện sau này. Các giá trị hiện tại hiển thị trên giao diện được đọc từ blockchain và có thể thay đổi; đừng dựa vào ảnh chụp màn hình cũ, thông báo cũ, hoặc giá trị đã cache.

Khóa quản trị, quyền sở hữu contract, thay đổi cấu hình, và khả năng sẵn có của Interest Contract là các rủi ro bổ sung. Hãy xem xét trạng thái on-chain hiện tại trước khi hành động.

## 7. Địa chỉ contract cần đối chiếu

Các giao diện chính thức hiện tại xác định các contract trên Polygon sau:

- **Token PRANA:** [0x928277e774F34272717EADFafC3fd802dAfBD0F5](https://polygonscan.com/address/0x928277e774f34272717eadfafc3fd802dafbd0f5)
- **Uniswap SwapRouter02:** [0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45](https://polygonscan.com/address/0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45)
- **PRANA Staking Contract:** [0x714425A4F4d624ef83fEff810a0EEC30B0847868](https://polygonscan.com/address/0x714425a4f4d624ef83feff810a0eec30b0847868)
- **PRANA Interest Contract:** [0x1DE1E9BEF781fb3440C2c22E8ca1bF61BD26f69d](https://polygonscan.com/address/0x1de1e9bef781fb3440c2c22e8ca1bf61bd26f69d)

Với approve ERC-20 của Swap, trường `to` của giao dịch có thể là contract token; **spender** phải là SwapRouter02. Với chính giao dịch Swap, trường `to` phải là SwapRouter02.

Với Permit PRANA dùng cho Staking, token được xác minh phải là token PRANA, spender phải là Staking Contract, và value phải là số lượng stake dự định. Các giao dịch Stake, Claim, Unstake, hoặc Early Unstake tiếp theo phải tương tác với Staking Contract.

Luôn đối chiếu địa chỉ từng ký tự. Nếu ví hiển thị chain, token, spender, contract, số lượng, hoặc hàm bất thường, hãy dừng lại và từ chối yêu cầu.

## 8. Trách nhiệm của người dùng

Trước khi ký hoặc gửi bất kỳ hành động nào, bạn có trách nhiệm:

- xác nhận bạn đang ở đúng tên miền website chính thức
- dùng Polygon mainnet và ví tương thích
- đối chiếu contract, token, spender, hàm, số lượng, và người nhận liên quan
- xem lại gas, mức tối thiểu nhận được, price impact, thời hạn, APR, đáo hạn, thời gian ân hạn, và thông tin phạt áp dụng cho hành động đó
- giữ đủ POL cho mọi giao dịch cần thiết, gồm cả claim hoặc unstake sau này
- bảo vệ thiết bị, ví, private key, seed phrase, và phương thức khôi phục
- tự kiểm tra trạng thái on-chain nếu giao diện bị chậm hoặc không sẵn có
- hiểu hệ quả thuế và pháp lý của các giao dịch của bạn

Không bao giờ chia sẻ seed phrase hoặc private key với THĐP hoặc bất kỳ ai tự nhận hỗ trợ PRANA. THĐP không cần cả hai để hỗ trợ một giao dịch công khai.

## 9. Dịch vụ bên thứ ba và dữ liệu blockchain công khai

Giao diện PRANA phụ thuộc vào Polygon, Uniswap, ví, nhà cung cấp RPC, nhà cung cấp hosting, và các hệ thống bên thứ ba khác. THĐP không sở hữu hoặc kiểm soát toàn bộ các hệ thống này và không chịu trách nhiệm về khả năng sẵn có, bảo mật, độ chính xác, hoặc điều khoản của chúng.

Giao dịch blockchain và hoạt động ví là công khai. Địa chỉ ví, số lượng token, tương tác contract, mã băm giao dịch, và timestamp có thể hiển thị vĩnh viễn và có thể bị bên thứ ba phân tích hoặc liên kết với thông tin khác.

## 10. Quyền riêng tư

Dữ liệu kỹ thuật có thể được xử lý khi bạn truy cập website hoặc dùng Giao diện PRANA, bao gồm log vận hành và hạ tầng, địa chỉ ví có trong request, dữ liệu quote và giao dịch Swap, và dữ liệu đọc tài khoản Staking.

Xem chi tiết tại [Chính sách quyền riêng tư](/privacy).

## 11. Không bảo đảm uptime hoặc tính năng liên tục

Website và Giao diện PRANA được cung cấp trên cơ sở “nguyên trạng” và “tùy khả năng sẵn có”. THĐP không bảo đảm hoạt động liên tục, dữ liệu không lỗi, tương thích với mọi ví hoặc thiết bị, hỗ trợ liên tục cho bất kỳ tài sản hoặc tính năng nào, hoặc truy cập không gián đoạn tới bất kỳ smart contract nào.

Một giao diện có thể được thay đổi, tạm dừng, hạn chế, hoặc ngừng cung cấp. Việc ngừng website không xóa các smart contract công khai hoặc bản ghi blockchain, nhưng có thể yêu cầu bạn dùng công cụ tương thích khác để tương tác với chúng.

## 12. Giới hạn trách nhiệm

Trong phạm vi tối đa được pháp luật áp dụng cho phép, THĐP và các bên liên quan không chịu trách nhiệm đối với tổn thất hoặc thiệt hại phát sinh từ việc sử dụng, hoặc không thể sử dụng, website hoặc Giao diện PRANA, bao gồm tổn thất do:

- thay đổi giá, slippage, thiếu thanh khoản, hoặc giao dịch thất bại
- smart contract, token, ví, chữ ký, approve, hoặc lỗi thao tác của người dùng
- khóa staking, phạt, hết thời hạn claim, hoặc lãi không sẵn có
- sự cố của Polygon, Uniswap, RPC, hosting, hoặc bên thứ ba khác
- dữ liệu giao diện không chính xác, chậm, đã cache, hoặc không sẵn có
- phishing, malware, thiết bị bị xâm nhập, hoặc truy cập ví trái phép

Mục này không loại trừ hoặc hạn chế những trách nhiệm mà pháp luật áp dụng không cho phép loại trừ hoặc hạn chế.

## 13. Thay đổi điều khoản

THĐP có thể cập nhật tài liệu này để phản ánh thay đổi về sản phẩm, kỹ thuật, vận hành, hoặc pháp lý. Phiên bản đăng trên website chính thức tại `/terms` là phiên bản hiện hành.

Việc tiếp tục sử dụng website hoặc Giao diện PRANA sau khi cập nhật đồng nghĩa với việc bạn chấp nhận phiên bản đã sửa đổi, trong phạm vi pháp luật áp dụng cho phép.

## 14. Liên hệ

Câu hỏi về các điều khoản này có thể gửi tới [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net).
