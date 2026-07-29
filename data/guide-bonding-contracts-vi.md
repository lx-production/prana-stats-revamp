# Giải thích Hợp đồng Bonding

Trang này giải thích các hợp đồng on-chain phía sau **PRANA Bonding**: **BuyPranaBondV2** và **SellPranaBondV2**. Nên đọc cùng [Hướng dẫn Bonding](/guide/bonding/) và [Điều khoản & Công bố rủi ro](/terms).

Cả hai contract chạy trên **Polygon**. Trang này mang tính giáo dục — luôn đối chiếu mã và tham số thực tế on-chain trước khi bonding.

**Ghi chú V1:** Deployment Buy/Sell Bond V1 chỉ còn để xem và claim bond lịch sử. **Bond mới chỉ tạo trên V2.**

## 1. Tổng quát

Bonding dùng **hai contract V2 độc lập**:

- **BuyPranaBondV2** — nhận **WBTC**, tạo bond vest **PRANA**
- **SellPranaBondV2** — nhận **PRANA**, tạo bond vest **WBTC**

Chúng không dùng chung một vault. Mỗi chiều có reserves, minimum, term, cờ pause và treasury commitment riêng.

Vòng đời điển hình:

1. Bạn approve token chi tiêu cho đúng contract V2
2. Bạn tạo bond với kỳ hạn đã chọn (`bondRates`)
3. Payout vest theo thời gian từ `creationTime` tới `maturityTime`
4. Bạn claim phần đã vest (một phần trước maturity (thời điểm đáo hạn), hoặc phần còn lại từ maturity)

## 2. Impacted reserves và price impact

Mỗi contract V2 giữ 2 bộ reserve:

- **Impacted reserves** (`impactedWbtcReserve`, `impactedPranaReserve`): reserve nội bộ đã tính tác động từ các bond trước đó.
- **Market reserves**: reserve live của pool Uniswap V3 tại thời điểm quote/create.

Sau mỗi lần tạo bond, impacted reserves được cập nhật. Vì vậy bond sau sẽ chịu **price impact lũy tiến**, không luôn quay về giá pool live.

**Quy tắc chọn giá khi quote/create:** contract luôn tính cả 2 nhánh rồi chọn nhánh **không cho user có giá tốt hơn market hiện tại**.

- **Mặc định dùng impacted**.
- Nếu impacted đang cho user lợi hơn giá DEX, contract sẽ **đồng bộ hóa (sync) impacted về pool** và dùng **market**.

Áp dụng cho cả 3 luồng (mua bằng WBTC, mua chính xác số PRANA, bán PRANA).

**Bonding OTC còn lợi ở đâu?** 

Phần chặn trên chỉ chặn baseline AMM (trước ưu đãi). Lợi thế OTC đến từ `bondRates`:

- Buy có thể được **discount**
- Sell có thể được **premium**
- Đổi lại payout sẽ **vest (nhả dần) theo kỳ hạn**

Nếu sau khi tính discount/premium + thời gian vesting mà bonding không tốt hơn swap DEX, thì nên swap trực tiếp trên DEX.

Lưu ý kỹ thuật:

- `calculate*Amount` (view) chỉ đọc impacted, không tự so sánh market.
- Nhánh auto-sync market nằm ở hàm create (backend quote mô phỏng theo logic này).
- `BOND_MANAGER_ROLE` (PRANA Protocol) có thể gọi `syncImpactedReserves` hoặc `setImpactedReserves` để chỉnh impacted reserves (thao tác admin, không đổi payout bond đã tạo).

## 3. Các đường tạo Buy Bond

BuyPranaBondV2 có hai hàm tạo on-chain:

- `buyBondForWbtcAmount(wbtcAmount, period)` — chi đúng số WBTC; PRANA payout được tính on-chain
- `buyBondForPranaAmount(pranaAmount, period)` — nhắm đúng số PRANA; chi phí WBTC được tính on-chain

UI Bonding và API quote chỉ dùng **`buyBondForWbtcAmount`**. Nhập số WBTC muốn chi. Không path nào nhận `minPranaOut` / `maxWbtcIn`. Với quy mô và traffic hiện tại của PRANA, thêm cơ chế này là dư thừa và dễ thành over-engineering; PRANA Protocol ưu tiên thiết kế tối giản.

## 4. Đường tạo Sell Bond

SellPranaBondV2 tạo bond bằng:

- `sellBond(pranaAmount, period)` — khóa đúng số PRANA muốn bán; WBTC payout được tính on-chain

## 5. Phí, kỳ hạn và minimum

Phép tính create/quote gồm **phí 1%**, khớp mức phí 1% của DEX pool.

Kỳ hạn lấy từ `bondRates` on-chain (rate và duration theo period id). UI đọc config V2 live và mặc định kỳ hạn 30 ngày.

Mỗi contract có **minimum** tạo bond riêng. Dưới minimum, đang pause, thiếu reserves, hoặc treasury không đủ sẽ làm quote không thể thực thi.

## 6. Claim và vesting

`claimBond(bondId)` trả phần đã vest hiện có khi không bị pause.

Vesting cộng dồn từ `creationTime`:

- Trước maturity: `floor(totalPayout × elapsed / duration) − claimed` (`làm tròn xuống(tổng payout × thời gian đã trôi / tổng thời gian vesting) − phần đã claim`)
- Từ maturity: phần còn lại `totalPayout − claimed` (`tổng payout − phần đã claim`), rồi bond có thể được đánh dấu claimed hết

`claimedPrana` / `claimedWbtc` là phần bị trừ. `lastClaimTime` chỉ chặn hai claim cùng timestamp.

## 7. Pause, treasury và role

Quyền admin / manager (`DEFAULT_ADMIN_ROLE` / `BOND_MANAGER_ROLE`), hay PRANA Protocol:

- **Pause / unpause** các đường create/claim có `whenNotPaused`
- Cập nhật **rates**, **minimums**, và **impacted reserves**
- **Withdraw** token dư theo quy tắc withdraw của contract: chỉ rút được phần **chưa cam kết**. Payout đã cam kết cho bond đang mở (`committedPrana` ở Buy / `committedWbtc` ở Sell) **không** rút được; admin chỉ rút phần dư = balance − committed. Token chiều còn lại (WBTC trên Buy, PRANA trên Sell) không bị khóa bởi committed nên có thể rút hết.
- Quản lý role / ownership theo AccessControl đã deploy

Số lượng treasury đã cam kết theo dõi payout còn nợ cho bond đang mở. Manager không thể tự tăng claimable của một bond đã tạo bằng cách đổi rate toàn cục sau create — mỗi bond lưu snapshot điều khoản payout lúc tạo.

Những gì manager **không** làm được theo ý đồ mã hiện tại:

- Lặng lẽ viết lại snapshot principal/payout/term của bond đã tạo qua cập nhật rate dành cho bond mới
- Claim thay người khác qua hàm admin claim công khai (không có)
- Bỏ yêu cầu người dùng tự có POL cho giao dịch create/claim của họ

Pause, cập nhật reserve, mức quỹ, và khóa role vẫn là rủi ro vận hành thật. Luôn đọc [Điều khoản & Công bố rủi ro](/terms).

## 8. Checklist trước khi bond

- Xác nhận **Polygon** và đúng địa chỉ Buy/Sell V1/V2 gắn từ [/bond/](/bond/)
- Nhớ: **bond mới = chỉ V2**; V1 chỉ xem/claim lịch sử
- Giữ một ít POL cho Approve, Create, và Claim sau này

Chi tiết từng lời nhắc trên ví: xem [Hướng dẫn Bonding](/guide/bonding/).