# Hướng dẫn PRANA Staking

Hướng dẫn này nêu các lời nhắc trên ví và các thao tác stake chính trên **PRANA Staking** tại [/stake/](/stake/). Đọc cùng với [Điều khoản & Công bố rủi ro](/terms).

Staking chạy trên **Polygon mainnet**. Hãy giữ sẵn **POL** để trả gas. PRANA vẫn nằm trong ví của bạn cho đến khi giao dịch stake thành công; sau đó, số dư gốc được stake sẽ nằm trong Staking Contract theo quy tắc của contract.

## 1. Hai lời nhắc ví của Permit & Stake

Nút chính là **Permit & Stake**. Một lần bấm có thể mở **hai** lời nhắc trên ví:

1. **Permit (chữ ký)** — ủy quyền EIP-2612 off-chain cho đúng số lượng PRANA
2. **Stake (giao dịch)** — giao dịch on-chain `stakeWithPermit` chuyển PRANA vào Staking Contract

Trên lời nhắc Permit, hãy kiểm tra:

- token là **PRANA**
- spender là **Staking Contract**
- số lượng khớp với stake bạn đã nhập
- chain là **Polygon**
- deadline / nonce trông đúng như kỳ vọng

Từ chối chữ ký nếu bất kỳ chi tiết nào sai.

Trên lời nhắc Stake, hãy kiểm tra:

- bạn đang tương tác với **Staking Contract**
- số lượng và kỳ hạn khớp với lựa chọn của bạn
- gas và mạng chấp nhận được

Nếu bạn đã ký Permit nhưng từ chối hoặc thất bại ở giao dịch Stake, Permit còn hiệu lực có thể được dùng lại. Nút có thể đổi thành **Continue Stake** / **Tiếp tục Stake** để bạn không cần ký Permit lại cho đến khi hết hạn hoặc không còn hợp lệ.

Trong lúc chờ, UI có thể hiện trạng thái đang ký, đang gửi, hoặc đang xác nhận. Một giao dịch stake đã broadcast nhưng chưa xác nhận là giao dịch pending — hãy chờ hoặc tiếp tục xác nhận, đừng mở thêm lệnh ghi trùng.

## 2. Cách claim

Mỗi vị thế stake đang hoạt động có thể tích lũy lãi denominated bằng PRANA theo quy tắc contract.

Để claim:

1. Kết nối đúng ví đã tạo stake
2. Tìm thẻ stake trong **Stake đang hoạt động**
3. Xem lãi đã tích lũy
4. Bấm **Claim lãi** và xác nhận giao dịch trên ví

Claim là một giao dịch on-chain riêng và tốn gas. Lãi được trả từ Interest Contract. Claim có thể thất bại nếu contract bị tạm dừng, quỹ không đủ, mạng không sẵn có, hoặc lời gọi bị revert vì lý do khác.

Lãi đã tích lũy hiển thị trên UI chỉ là ước tính từ dữ liệu contract công khai và làm tròn số nguyên. Số lượng cuối cùng on-chain có thể hơi khác.

Bạn có thể claim lãi đủ điều kiện khi stake còn hiệu lực, và sau đáo hạn chỉ đến khi hết thời gian ân hạn (grace period).

## 3. Maturity và grace period

**Maturity** (đáo hạn) là thời điểm kỳ hạn stake kết thúc. Khi đáo hạn, gốc đủ điều kiện unstake theo quy tắc contract, và phần lãi còn claim được vẫn chịu giới hạn của cửa sổ ân hạn.

**Grace period** (thời gian ân hạn) là khoảng thời gian giới hạn sau đáo hạn mà bạn vẫn còn claim được phần lãi đủ điều kiện còn lại. Sau khi hết grace period:

- lãi chưa claim không còn claim được nữa
- gốc vẫn có thể đủ điều kiện để unstake

Hãy tự theo dõi đáo hạn. Giao diện có thể hiện các nhãn trạng thái như đang chạy, đã đáo hạn, claim trước, hoặc hết grace. Đừng chỉ dựa vào ảnh chụp màn hình hoặc thông báo cũ cho cấu hình grace hiện tại — các giá trị được đọc từ chain và có thể thay đổi với stake mới hoặc cấu hình toàn cục.

## 4. Unstake

**Unstake** trả lại số dư gốc đã stake sau khi đáo hạn.

Quy tắc quan trọng trên UI chính thức:

- nếu stake đã đáo hạn vẫn còn lãi claim được trong grace period, bạn phải **claim trước**
- nếu unstake trước khi claim, bản ghi stake sẽ bị xóa và lãi chưa claim có thể bị mất

Sau khi unstake thành công:

- gốc trở về ví của bạn (trừ gas đã trả cho giao dịch)
- thẻ stake đó biến mất khỏi danh sách đang hoạt động

Unstake là giao dịch on-chain. Hãy xác nhận bạn đang tương tác với Staking Contract trước khi ký.

## 5. Early unstake

**Early unstake** (unstake sớm) cho phép bạn thoát trước đáo hạn, kèm các hình phạt theo contract:

- **phạt early-unstake** đã cấu hình được trừ vào gốc
- **toàn bộ lãi đã tích lũy nhưng chưa claim** của vị thế đó bị mất
- khoản phạt được Staking Contract chuyển sang Interest Contract
- bạn cũng phải trả gas Polygon

UI chính thức hiện hộp thoại xác nhận với tỷ lệ phạt, số nhận ước tính, và cảnh báo mất lãi. Hãy đọc các số đó trước khi xác nhận.

Phạt early-unstake là quy tắc của smart contract, không phải phí giao diện riêng do THĐP thu. Tỷ lệ hiện tại có thể thay đổi qua cấu hình contract cho các hành động sau này; luôn tin các giá trị hiển thị tại thời điểm xác nhận.

Về địa chỉ contract, ý nghĩa APR, và toàn bộ ngôn ngữ rủi ro, xem [Điều khoản & Công bố rủi ro](/terms).
