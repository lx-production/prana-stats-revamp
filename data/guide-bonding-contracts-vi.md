# Giải thích Hợp đồng Bonding

Trang này giải thích các hợp đồng on-chain phía sau **PRANA Bonding**: **BuyPranaBondV2** và **SellPranaBondV2**. Nên đọc cùng [Hướng dẫn Bonding](/guide/bonding/) và [Điều khoản & Công bố rủi ro](/terms).

Cả hai contract chạy trên **Polygon**. Địa chỉ được gắn từ [/bond/](/bond/) và Polygonscan. Trang này mang tính giáo dục — luôn đối chiếu mã và tham số thực tế on-chain trước khi bonding.

**Ghi chú V1:** Deployment Buy/Sell Bond V1 chỉ còn để xem và claim bond lịch sử. **Bond mới chỉ tạo trên V2.**

## 1. Big picture

Bonding dùng **hai contract V2 độc lập**:

- **BuyPranaBondV2** — nhận **WBTC**, tạo bond vest **PRANA**
- **SellPranaBondV2** — nhận **PRANA**, tạo bond vest **WBTC**

Chúng không dùng chung một vault. Mỗi chiều có reserves, minimum, term, cờ pause và treasury commitment riêng.

Vòng đời điển hình:

1. Bạn approve token chi tiêu cho đúng contract V2
2. Bạn tạo bond với kỳ hạn đã chọn (`bondRates`)
3. Payout vest theo thời gian từ `creationTime` tới `maturityTime`
4. Bạn claim phần đã vest (một phần trước maturity, hoặc phần còn lại từ maturity)



## 2. Impacted reserves và price impact

Mỗi contract V2 giữ 2 bộ reserve:

- **Impacted reserves** (`impactedWbtcReserve`, `impactedPranaReserve`): reserve nội bộ đã tính tác động từ các bond trước đó.
- **Market reserves**: reserve live của pool Uniswap V3 tại thời điểm quote/create.

Sau mỗi lần tạo bond, impacted reserves được cập nhật. Vì vậy bond sau sẽ chịu **price impact lũy tiến**, không luôn quay về giá pool live.

**Quy tắc chọn giá khi quote/create:** contract luôn tính cả 2 nhánh rồi chọn nhánh **không cho user có giá tốt hơn market hiện tại**.

- **Mặc định dùng impacted**.
- Nếu impacted đang cho user lợi hơn giá DEX, contract sẽ **sync impacted về pool** và dùng **market**.

Áp dụng cho cả 3 flow (buy exact WBTC, buy target PRANA, sell exact PRANA).

**Bonding OTC còn lợi ở đâu?**  
Phần chặn trên chỉ chặn baseline AMM (trước ưu đãi). Lợi thế OTC đến từ `bondRates`:

- Buy có thể được **discount**
- Sell có thể được **premium**
- Đổi lại payout sẽ **vest theo kỳ hạn**

Nếu sau khi tính discount/premium + thời gian vesting mà bonding không tốt hơn swap DEX, thì nên swap trực tiếp trên DEX.

Lưu ý kỹ thuật:

- `calculate*Amount` (view) chỉ đọc impacted, không tự so sánh market.
- Nhánh auto-sync market nằm ở hàm create (backend quote mô phỏng theo logic này).
- `BOND_MANAGER_ROLE` (PRANA Protocol) có thể gọi `syncImpactedReserves` hoặc `setImpactedReserves` để chỉnh impacted reserves (thao tác admin, không đổi payout bond đã tạo).

## 3. Các đường tạo Buy Bond

BuyPranaBondV2 có hai hàm tạo:

- `buyBondForWbtcAmount(wbtcAmount, period)` — chi đúng số WBTC; PRANA payout được tính on-chain
- `buyBondForPranaAmount(pranaAmount, period)` — nhắm đúng số PRANA; chi phí WBTC được tính on-chain

Giới hạn quan trọng trong contract hiện tại:

- **Không** có `minPranaOut` ở exact-WBTC buy
- **Không** có `maxWbtcIn` ở target-PRANA buy

Vì vậy UI chính thức không thể hứa khóa output hoặc trần input on-chain cứng ngoài ERC-20 allowance dùng như spending cap thực tế cho Target PRANA.

## 4. Đường tạo Sell Bond

SellPranaBondV2 tạo bond bằng:

- `sellBond(pranaAmount, period)` — khóa đúng số PRANA; WBTC payout được tính on-chain

**Không** có `minWbtcOut`. Exact PRANA vào là cố định; WBTC ra vẫn có thể đổi nếu reserves/rate/treasury đổi trước khi thực thi.

## 5. Phí, term và minimum

Phép tính create/quote gồm **phí 1%** khớp công thức Solidity (chia nguyên / làm tròn xuống).

Term lấy từ `bondRates` on-chain (rate và duration theo period id). UI đọc config V2 live và ưu tiên kỳ hạn 30 ngày nếu có.

Mỗi contract có **minimum** tạo bond riêng. Dưới minimum, đang pause, thiếu reserves, hoặc treasury không đủ sẽ làm quote không executable.

## 6. Claim và vesting

`claimBond(bondId)` trả phần đã vest hiện có khi không bị pause.

Vesting cộng dồn từ `creationTime`:

- Trước maturity: `floor(totalPayout × elapsed / duration) − claimed`
- Từ maturity: phần còn lại `totalPayout − claimed`, rồi bond có thể được đánh dấu claimed hết

`claimedPrana` / `claimedWbtc` là phần bị trừ. `lastClaimTime` chỉ chặn hai claim cùng timestamp; **không** mở lại cửa sổ vesting từ lần claim gần nhất như lãi Staking.

## 7. Pause, treasury và role

Quyền admin / manager (`DEFAULT_ADMIN_ROLE` / `BOND_MANAGER_ROLE`):

- **Pause / unpause** các đường create/claim có `whenNotPaused`
- Cập nhật **rates**, **minimums**, và **impacted reserves**
- **Withdraw** token dư theo quy tắc withdraw của contract
- Quản lý role / ownership theo AccessControl đã deploy

Số lượng treasury đã commit theo dõi payout còn nợ cho bond đang mở. Manager không thể tự tăng claimable của một bond đã tạo bằng cách đổi rate toàn cục sau create — mỗi bond lưu snapshot điều khoản payout lúc tạo.

Những gì manager **không** làm được theo ý đồ mã hiện tại:

- Viết lại lặng lẽ snapshot principal/payout/term của bond đã tạo qua cập nhật rate dành cho bond mới
- Claim thay người khác qua hàm admin claim công khai (không có)
- Bỏ yêu cầu người dùng tự có POL cho giao dịch create/claim của họ

Pause, cập nhật reserve, mức quỹ, và khóa role vẫn là rủi ro vận hành thật. Luôn đọc [Điều khoản & Công bố rủi ro](/terms).

## 8. Checklist trước khi bond

- Xác nhận **Polygon** và đúng địa chỉ Buy/Sell V1/V2 gắn từ [/bond/](/bond/)
- Nhớ: **bond mới = chỉ V2**; V1 chỉ xem/claim lịch sử
- Hiểu không có bảo vệ `minOut` / `maxIn` on-chain khi tạo
- Với Target PRANA Buy, coi allowance WBTC là spending cap thực tế
- Giữ POL cho Approve, Create, và Claim sau này
- Xem các issue pause / minimum / reserve / treasury trên quote trước khi xác nhận

Chi tiết từng lời nhắc trên ví: xem [Hướng dẫn Bonding](/guide/bonding/).