# Hướng dẫn PRANA Bonding

Hướng dẫn này nêu các lời nhắc trên ví và các thao tác bond chính trên **PRANA Bonding** tại [/bond/](/bond/). Đọc cùng với [Điều khoản & Công bố rủi ro](/terms).

Bonding chạy trên **Polygon mainnet**. Hãy giữ sẵn **POL** để trả gas. Bond mới chỉ được tạo trên contract **V2**. Bond **V1** cũ vẫn hiển thị để theo dõi vesting và claim — giao diện này không mở bond V1 mới.

## 1. Approve trước khi tạo bond

Tạo bond thường cần **Approve** ERC-20 trước:

- **Buy Bond** chi **WBTC** — approve spender là Buy Bond V2
- **Sell Bond** chi **PRANA** — approve spender là Sell Bond V2

Nút chính đi theo các phase: **Approve** → **Review** → **Create Bond** → **Confirming**. Một lần bấm không tự mở liên tiếp cả Approve lẫn Create. Nếu allowance đã khớp số cần, UI bỏ qua Approve và vào thẳng Review.

Trên lời nhắc Approve, hãy kiểm tra:

- token là **WBTC** (Buy) hoặc **PRANA** (Sell)
- spender là đúng contract bond **V2** tương ứng
- số lượng hoặc spending cap khớp với giao diện
- chain là **Polygon**

Từ chối request nếu bất kỳ chi tiết nào bất thường.

## 2. Buy Bond — exact WBTC

Buy Bond khóa **WBTC** và vest (nhả dần) **PRANA** (payout) theo kỳ hạn đã chọn.

Bạn nhập số WBTC muốn chi. Quote hiện PRANA payout dự kiến. Lệnh contract dùng đúng số WBTC đó (`buyBondForWbtcAmount`).

Trước khi tạo, app tự fresh-quote. Nếu raw amount không đổi thì tiếp tục; nếu đổi thì Review cập nhật trước khi tiếp tục tạo bond.

## 3. Sell Bond

Sell Bond khóa **PRANA** và vest **WBTC** theo kỳ hạn đã chọn.

Bạn luôn nhập exact PRANA. Quote hiện WBTC payout dự kiến. Lệnh contract là `sellBond(pranaAmount, period)`. 

Allowance phải ≥ đúng số PRANA nhập. MAX dùng cho Buy WBTC và Sell PRANA.

## 4. Vesting và claim

Mỗi bond đang hiệu lực hiện principal (vốn gốc), tổng payout, đã claim, claimable (có thể claim), và tiến độ vesting.

Công thức claimable (cùng ý với contract):

- Trước maturity: tổng đã vest tăng từ `creationTime` tới `maturityTime`, claimable = tổng đã vest trừ phần đã claim
- Từ maturity: claim toàn bộ phần còn lại; contract đánh dấu bond đã claimed khi không còn gì
- `lastClaimTime` chỉ chặn hai claim cùng timestamp — **không** mở cửa sổ vesting mới

Để claim:

1. Kết nối đúng ví sở hữu bond
2. Xem bond trong danh sách **Bond đang hoạt động**
3. Xem claimable và tiến độ
4. Bấm **Claim** và xác nhận giao dịch

Claim là giao dịch on-chain riêng và tốn gas. Giao diện tự động chọn đúng contract Buy/Sell × V1/V2. Nếu deployment đó đang pause, claim bị khóa kèm lý do rõ ràng.

## 5. Treasury, pause, và giới hạn quote

Quote có thể không thể thực thi dù đơn đã điền. Các lý do thường gặp:

- contract **paused**
- số lượng dưới **minimum** on-chain
- payout vượt **reserves** khả dụng
- treasury không đủ để cover payout đã commit

Quote gồm **phí 1%** trong phép tính (giống contract và phí swap trên DEX pool). Rate và duration lấy từ `bondRates` on-chain. Quote được tính tại block server đọc; chỉ riêng thời gian trôi qua không làm quote đổi nếu reserves, rate và treasury không đổi.

Cách BuyPranaBondV2 và SellPranaBondV2 hoạt động (quyền và giới hạn của manager): xem [Giải thích Hợp đồng](/guide/bonding-contracts/). Về địa chỉ và toàn bộ ngôn ngữ rủi ro: xem [Điều khoản & Công bố rủi ro](/terms).
