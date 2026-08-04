# Giải thích Hợp đồng

Trang này giải thích cách hai hợp đồng on-chain phía sau **PRANA Staking** hoạt động: **Hợp đồng Staking** và **Hợp đồng Interest**. Nên đọc cùng [Hướng dẫn Staking](/guide/staking/) và [Điều khoản & Công bố rủi ro](/terms).

Cả hai hợp đồng chạy trên **Polygon**. Địa chỉ được hiển thị tại [/stake/](/stake/) và trên Polygonscan. Đây là trang giải thích — luôn tự kiểm tra mã và tham số hợp đồng trên chain trước khi stake.

## 1. Tổng quan cơ chế

Staking dùng **hai hợp đồng**, mỗi bên một việc:

- **Hợp đồng Staking** — giữ PRANA đã stake (vốn gốc) của từng người dùng, lưu điều khoản stake, và xử lý logic stake / claim / unstake
- **Hợp đồng Interest** — giữ PRANA dùng để trả lãi; chỉ Hợp đồng Staking mới được gọi để trả lãi cho người dùng

Vốn gốc và quỹ lãi **không** nằm chung một hợp đồng. Lãi được trả từ Hợp đồng Interest; vốn gốc được trả lại từ Hợp đồng Staking khi bạn unstake.

Vòng đời thường gặp:

1. Bạn stake PRANA vào Hợp đồng Staking (qua Permit + `stakeWithPermit`)
2. Lãi tích lũy theo thời gian và APR đã khóa vào stake đó
3. Bạn claim lãi (Hợp đồng Staking nhờ Hợp đồng Interest chuyển PRANA cho bạn)
4. Sau đáo hạn bạn unstake để nhận lại vốn — hoặc thoát sớm với phí phạt

## 2. Hợp đồng Staking — làm gì?

Mỗi stake lưu một “ảnh chụp” riêng:

- id stake
- số vốn gốc
- thời điểm bắt đầu và kỳ hạn
- **APR tại thời điểm stake** (sau này đổi cấu hình APR không ghi đè stake cũ)
- thời điểm claim gần nhất

Người stake có thể:

- **Stake** — chuyển PRANA vào hợp đồng theo kỳ hạn được phép (cần đủ mức tối thiểu và kỳ hạn hợp lệ; hợp đồng có thể đang tạm dừng)
- **Claim lãi** — nhận lãi PRANA đã tích lũy trong cửa sổ claim (từ lúc bắt đầu stake đến hết đáo hạn + grace period)
- **Unstake** — sau đáo hạn, nhận lại toàn bộ vốn gốc
- **Unstake sớm** — trước đáo hạn, nhận vốn gốc trừ phí phạt; lãi đã tích lũy của stake đó không được trả

Các quy tắc quan trọng khác:

- Công thức lãi on-chain dùng phép chia số nguyên (tích lũy theo giây từ lãi năm). Ước tính trên UI có thể lệch nhẹ so với số nhận được on-chain.
- Sau đáo hạn, lãi còn claim được chỉ trong **grace period** — khoảng thời gian ân hạn sau khi stake đáo hạn, trong đó bạn vẫn claim được lãi còn lại. Độ dài grace lấy từ cấu hình on-chain (owner có thể đổi; không cố định). Trên [/stake/](/stake/), khi một stake đã đáo hạn và vẫn còn trong cửa sổ ân hạn, thẻ stake hiện countdown thời gian ân hạn còn lại. Hết grace thì lãi chưa claim không nhận được nữa; vốn gốc vẫn có thể unstake.
- PRANA phạt unstake sớm được chuyển sang Hợp đồng Interest (có thể dùng để trả lãi sau này).
- Khi hợp đồng **tạm dừng (paused)**, các thao tác stake / claim / unstake dùng `whenNotPaused` sẽ bị chặn.

## 3. Hợp đồng Interest — làm gì?

Hợp đồng Interest là kho quỹ trả thưởng staking:

- Giữ PRANA mà PRANA Protocol nạp vào để chi trả lãi
- Chỉ **Hợp đồng Staking** đã cấu hình mới gọi được `payInterest` để gửi PRANA cho người dùng
- Địa chỉ Hợp đồng Staking chỉ được owner set **một lần** (`stakingContractSet` thành true và không đổi được trong mã hiện tại)

Vì vậy trả lãi không phải đường “owner gửi tùy ý cho ai cũng được” — tiền lãi đi qua logic claim của staking.

## 4. Owner (PRANA Protocol) có thể làm gì

Owner ở đây là địa chỉ `Ownable` on-chain của từng hợp đồng (PRANA Protocol / địa chỉ đang là owner). Ownership cũng có thể được chuyển bằng hàm của OpenZeppelin `Ownable`.

Trên **Hợp đồng Staking**, owner có thể:

- **Tạm dừng / mở lại** các thao tác staking (`setPaused`)
- **Cập nhật APR** theo các kỳ hạn đã cấu hình (stake mới dùng APR mới; stake cũ giữ APR đã lưu)
- **Đổi mức stake tối thiểu**
- **Đổi grace period** sau đáo hạn
- **Đổi % phạt unstake sớm** (trong mã hiện tại tối đa 20%)
- **Rescue token không phải PRANA** bị gửi nhầm vào Hợp đồng Staking
- Chuyển ownership

Trên **Hợp đồng Interest**, owner có thể:

- **Set địa chỉ Hợp đồng Staking một lần** sau khi deploy
- **Rút PRANA dư** chỉ phần vượt quá số mà `totalInterestNeeded()` còn cần giữ cho các stake đang active / còn claim được
- Chuyển ownership

Đây là quyền vận hành thật. Đặc biệt pause có thể tạm thời chặn thao tác của người dùng cho đến khi được mở lại.

## 5. Owner không thể làm gì (theo mã hợp đồng hiện tại)

Với mã hợp đồng như đang viết, owner **không thể**:

- Rút trực tiếp **PRANA đã stake** của người dùng khỏi Hợp đồng Staking — `rescueToken` cấm rescue token PRANA
- Ghi đè APR hoặc vốn gốc của một stake **đã tạo**
- Đổi Hợp đồng Interest sang một Staking Contract khác sau khi đã set
- Rút PRANA trong Hợp đồng Interest mà `totalInterestNeeded()` vẫn cần giữ — chỉ rút được phần dư trên mức dự trữ đó
- Tự gọi `payInterest` với tư cách owner — chỉ Hợp đồng Staking mới trả lãi được
- Chiếm hoặc chuyển stake / số dư của người khác qua một hàm admin (không có hàm kiểu đó)

Lưu ý quan trọng: “không có hàm rút vốn gốc của user” **không** đồng nghĩa “không còn rủi ro admin.” Pause, đổi tham số, chuyển ownership, mức quỹ Interest, và rủi ro smart contract / mạng vẫn tồn tại. Hãy đọc [Điều khoản & Công bố rủi ro](/terms).

## 6. Checklist thực tế trước khi stake

- Xác nhận bạn đang ở **Polygon** và tương tác đúng địa chỉ Staking / Interest chính thức trên [/stake/](/stake/)
- Hiểu APR được cố định **theo từng stake lúc tạo**, trong khi cấu hình chung (min stake, grace, phạt, pause, APR công bố cho stake mới) vẫn có thể đổi
- Lên kế hoạch claim trước khi hết grace nếu muốn nhận lãi còn lại sau đáo hạn — theo dõi countdown ân hạn trên thẻ stake tại [/stake/](/stake/)
- Giữ POL để trả gas; Permit là chữ ký, còn Stake / Claim / Unstake là giao dịch on-chain
- Coi số dư / khả năng nạp quỹ của Hợp đồng Interest là điều kiện vận hành để claim thành công

Chi tiết từng lời nhắc trên ví: xem [Hướng dẫn Staking](/guide/staking/).
