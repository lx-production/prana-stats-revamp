# Giải thích Hợp đồng Bonding

Trang này giải thích các hợp đồng trên Polygon phía sau **PRANA Bonding**: **BuyPranaBondV2** và **SellPranaBondV2**. Nên đọc cùng [Hướng dẫn Bonding](/guide/bonding/) và [Điều khoản & Công bố rủi ro](/terms).

**Ghi chú V1:** 2 hợp đồng Buy/Sell Bond V1 chỉ còn để xem và claim bond lịch sử. **Bond mới chỉ tạo trên V2.**

## 1. Tổng quát

Bonding dùng **hai hợp đồng V2 độc lập**:

- **BuyPranaBondV2** — nhận **WBTC**, tạo bond vest (nhả dần) **PRANA** (payout)
- **SellPranaBondV2** — nhận **PRANA**, tạo bond vest **WBTC** (payout)

Chúng không dùng chung một kho. Mỗi chiều có các thông số reserves (dự trữ), minimum, kỳ hạn, cờ pause (tạm ngưng) và khối lượng PRANA + WBTC Protocol đang cam kết riêng.

Vòng đời điển hình:

1. Bạn approve token chi tiêu cho đúng hợp đồng V2
2. Bạn tạo bond với kỳ hạn đã chọn (`bondRates`)
3. Payout vest theo thời gian từ `creationTime` (thời điểm tạo bond) tới `maturityTime` (thời điểm đáo hạn)
4. Bạn claim phần đã vest (một phần trước thời điểm đáo hạn, hoặc phần còn lại từ thời điểm đáo hạn)

## 2. Impacted reserves và price impact

Mỗi hợp đồng V2 giữ 2 bộ reserve:

- **Impacted reserves** (`impactedWbtcReserve`, `impactedPranaReserve`): reserve nội bộ đã tính tác động từ các bond trước đó.
- **Market reserves**: reserve live của pool Uniswap V3 tại thời điểm quote/create.

Sau mỗi lần tạo bond, impacted reserves được cập nhật. Vì vậy bond sau sẽ chịu **price impact lũy tiến**, không luôn quay về giá pool live. Đây là điểm khác biệt duy nhất giữa V1 và V2. V1 không có **Impacted Reserves**.

**Quy tắc chọn giá khi quote/create:** hợp đồng luôn tính cả 2 nhánh rồi chọn nhánh **không cho user có giá tốt hơn market hiện tại**.

- **Mặc định dùng impacted**.
- Nếu impacted đang cho user lợi hơn giá DEX, hợp đồng sẽ **đồng bộ hóa (sync) impacted về pool** và dùng **market**.

Áp dụng cho cả 2 luồng (mua & bán PRANA).

**Bonding OTC còn lợi ở đâu?**

**OTC** (Over-The-Counter — giao dịch thỏa thuận ngoài sàn) nghĩa là đổi token qua bonding với Protocol thay vì swap trực tiếp trên DEX pool. Lệnh không đụng thanh khoản spot ngay; giá và payout do hợp đồng bonding tính, rồi token nhận về vest theo kỳ hạn.

Phần đồng bộ hóa impacted reserves trên chỉ được thực hiện với giá gốc (trước ưu đãi). Lợi thế OTC đến từ `bondRates`:

- Buy có thể được phần trăm **discount** (rẻ hơn giá gốc)
- Sell có thể được phần trăm **premium** (cao hơn giá gốc)
- Đổi lại payout sẽ **vest theo kỳ hạn**

Nếu sau khi tính discount/premium + thời gian vesting mà bonding không tốt hơn swap DEX, thì nên swap trực tiếp trên DEX.

Lưu ý kỹ thuật:

- `calculate*Amount` (view) chỉ đọc impacted, không tự so sánh market.
- Nhánh auto-sync market nằm ở hàm create (backend quote mô phỏng theo logic này).
- `BOND_MANAGER_ROLE` (PRANA Protocol) có thể gọi `syncImpactedReserves` (đồng bộ hóa impacted reserves về pool) hoặc `setImpactedReserves` để chỉnh impacted reserves (thao tác admin, không đổi payout bond đã tạo). Tần suất và thời điểm `syncImpactedReserves` được quyết định nội bộ, không thông báo trước.

## 3. Các đường tạo Buy Bond

BuyPranaBondV2 có hai hàm tạo on-chain:

- `buyBondForWbtcAmount(wbtcAmount, period)` — chi đúng số WBTC; PRANA payout được tính on-chain
- `buyBondForPranaAmount(pranaAmount, period)` — nhắm đúng số PRANA; chi phí WBTC được tính on-chain

UI Bonding và API quote chỉ dùng **`buyBondForWbtcAmount`**. Nhập số WBTC muốn chi. Không path nào nhận `minPranaOut` / `maxWbtcIn`. Với quy mô và traffic hiện tại của PRANA, thêm cơ chế này là dư thừa và phức tạp hóa thiết kế không cần thiết; PRANA Protocol ưu tiên sự tối giản.

## 4. Đường tạo Sell Bond

SellPranaBondV2 tạo bond bằng:

- `sellBond(pranaAmount, period)` — khóa đúng số PRANA muốn bán; WBTC payout được tính on-chain

## 5. Phí, kỳ hạn và minimum

Phép tính create/quote gồm **phí 1%**, giống mức phí 1% của DEX pool.

Kỳ hạn lấy từ `bondRates` on-chain (rate và duration theo period id). UI đọc configs V2 live và mặc định kỳ hạn 30 ngày.

Mỗi hợp đồng có **minimum** tạo bond riêng. Dưới minimum, đang pause, thiếu reserves, hoặc treasury không đủ sẽ làm quote không thể thực thi.

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
- **Withdraw** token dư theo quy tắc withdraw của hợp đồng: chỉ rút được phần **chưa cam kết**. Payout đã cam kết cho bond đang mở (`committedPrana` ở Buy / `committedWbtc` ở Sell) **không** rút được; admin chỉ rút phần dư = balance − committed. Token chiều còn lại (WBTC trên Buy, PRANA trên Sell) không bị khóa bởi committed nên có thể rút hết.
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