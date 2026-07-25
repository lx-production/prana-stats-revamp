# Tích hợp Bonding UI vào main app tại `/bond/`

## Tóm tắt

- Chuyển bonding legacy thành lazy feature TypeScript trong main Vite app, dùng chung Web3 providers, React Query, VI/EN, footer và design system.
- Giữ Buy/Sell Bond V2, quản lý và claim bond V1/V2; bỏ các donut/status trùng với Bonding Stats trên homepage.
- Buy Bond giữ hai chế độ nhập: WBTC chính xác hoặc target PRANA.
- Contract reads và quote đi qua backend; ví chỉ trực tiếp gửi `approve`, tạo bond và `claim`.
- Quote là ước tính vì contract không nhận ngưỡng output tối thiểu (`minOut`) hoặc input tối đa (`maxIn`); UI phải cảnh báo và preflight lại trước giao dịch.

## Các bước triển khai

1. **Thiết lập lazy route** `/bond/`
   - Thêm `BOND_PATH`, `BOND_CANONICAL_PATH`, `isBondPath`.
   - Tạo `BondingEntry` bọc `BondingPage` bằng `Web3Providers`; load bằng `React.lazy` trong `main.tsx`.
   - Node redirect `/bond` → `/bond/` bằng `308`, giữ query string; `/bond/*` trả SPA shell.
   - Chuyển Hero BOND từ URL tuyệt đối sang `BOND_CANONICAL_PATH`.
   - Đảm bảo vào `/bond/` không tải `StatsPage`, GLB hoặc dữ liệu homepage.
   - **Kiểm thử Bước 1**
      - Unit test `isBondPath`: nhận `/bond`, `/bond/`, `/bond/preview`; từ chối `/bonding`, `/bonds` và `/`.
      - Server route test: `/bond?ref=hero` trả `308` tới `/bond/?ref=hero`; refresh `/bond/` và `/bond/*` đều trả fixture SPA shell.
      - Test Hero dùng constant canonical thay vì URL production hardcode.
      - Production build phải có chunk `BondingEntry`/`BondingPage` riêng. Kiểm tra chunk entry chung và `StatsPage` không import module bonding.
      - Chạy trang `/bond/` với network log sạch: không có request tới JSON stats, model GLB hoặc chunk `StatsPage`.

2. **Chuẩn hóa constants, ABI và types**
   - Mở rộng `constants/bonds.ts` thành nguồn chuẩn cho Buy/Sell V1/V2, dùng ABI tối thiểu typed `as const`.
   - Chỉ giữ V2 ABI cho tạo bond; V1/V2 đều có read active bonds và `claimBond`.
   - Dùng lại PRANA/WBTC address, decimals, pool và network constants hiện tại; không sao chép constants từ legacy.
   - Tạo `features/bonding` types cho term, config, account, quote, active bond và transaction lifecycle.
   - Token amounts, allowance và bond ID đi qua JSON dưới dạng decimal string; không ép sang `number`.
   - **Kiểm thử Bước 2**
      - Typecheck xác nhận tên hàm và tuple V1/V2 khớp với `readContract`, `simulateContract` và `writeContract`.
      - Characterization test so sánh bốn địa chỉ deployment, token decimals và pool address với constants legacy trước khi xóa legacy.
      - ABI contract test xác nhận V1 chỉ cần active-bond read/claim, còn create functions chỉ trỏ V2.
      - Test mapper với amount và bond ID lớn hơn `Number.MAX_SAFE_INTEGER`; JSON vẫn giữ đúng decimal string.
      - Static search không còn address literal hoặc bản ABI thứ hai trong `features/bonding`, server loader và UI.

3. **Xây backend Bonding API**
   - `GET /api/bonding/config`: cache private 30 giây; trả chain/block, trạng thái paused của bốn deployment, min Buy/Sell, term/rate/duration V2 và địa chỉ contract/token.
   - `GET /api/bonding/account?address=…`: `private, no-store`; trả PRANA/WBTC balance, allowance cho hai V2 contract và active Buy/Sell bonds từ cả V1/V2.
   - `POST /api/bonding/quote`: `no-store`; request là union `buy_exact_wbtc`, `buy_target_prana` hoặc `sell_exact_prana`, gồm `amountRaw` và `termId`.
   - Quote response trả `wbtcAmountRaw`, `pranaAmountRaw`, rate/duration, block timestamp, nguồn reserve `impacted|market` và các issue như paused, dưới minimum, vượt reserve hoặc thiếu treasury.
   - Mọi reads trong một response dùng cùng `blockTag`; quote mô phỏng đúng thứ tự bigint/rounding/1% fee của Solidity và nhánh tự đồng bộ market reserve.
   - Validate body/content-type/origin, giới hạn body 2 KB, 10 quote/IP/phút + 60 toàn server/phút; account dùng 10/IP + 120 toàn server/phút.
   - Lỗi RPC trả `502` đã redact; input sai trả `400`; trạng thái quote không executable vẫn trả `200` kèm issue để form hiển thị đúng lý do.
   - **Vì sao Bonding có body/content-type/origin validation nhưng Staking không có**
      - Hai Staking endpoint hiện tại đều là `GET`. Chúng không nhận JSON body, nên không có body size hoặc `Content-Type` để kiểm tra. Staking vẫn validate method, checksum `address`, rate limit và redact lỗi RPC.
      - Bonding config/account cũng là `GET` và áp dụng cùng mô hình với Staking.
      - Chỉ Bonding quote là `POST` vì request có discriminated union và raw amount. Endpoint này phải giới hạn 2 KB, yêu cầu JSON và reject body sai shape để tránh parser/memory abuse hoặc RPC calls vô nghĩa.
      - Origin validation ở quote là lớp chống website khác dùng trình duyệt người dùng để tiêu quota RPC của PRANA; đây không phải cơ chế xác thực tuyệt đối vì client ngoài trình duyệt có thể tự đặt header. Rate limit và strict input validation vẫn là lớp bảo vệ chính.
      - Swap cần thêm transaction verification vì backend Swap tạo route/calldata động và cần đối chiếu transaction đã gửi. Bonding backend chỉ trả số quote; client gọi fixed contract address/function từ ABI nội bộ, nên chưa cần `/verify-transaction`. Trước write vẫn bắt buộc fresh quote và `simulateContract`.
   - **Kiểm thử Bước 3**
      - Config: chỉ nhận `GET`, trả cache 30 giây, đúng bốn paused state/terms/minimum và mọi read dùng cùng `blockTag`.
      - Account: thiếu/sai address trả `400` trước khi tiêu rate-limit quota; address hợp lệ được checksum; response có `private, no-store`.
      - Account mapper: hợp nhất đủ Buy/Sell × V1/V2, không làm rơi bond khi ID trùng giữa deployment, và hard-fail `502` thay vì trả danh sách thiếu nếu một contract read lỗi.
      - Quote method/content: non-POST trả `405`; content type không phải JSON, body rỗng, JSON lỗi, body trên 2 KB hoặc union sai đều bị từ chối mà không gọi loader/RPC.
      - Quote origin: same-origin hợp lệ được nhận; browser origin không được phép bị từ chối; request không có `Origin` từ server-to-server được xử lý theo cùng policy hiện có của Swap.
      - Rate-limit test riêng cho quote/account, gồm per-IP, global bucket, trusted proxy hop và cleanup bucket.
      - Quote math fixture cho cả ba mode; kiểm tra đúng nhánh `impacted`/`market`, 1% fee, basis points, thứ tự chia bigint và rounding xuống như Solidity.
      - Boundary fixtures: zero, dưới minimum, term ngoài `0..4`, target bằng/vượt reserve, treasury vừa đủ/thiếu một raw unit và paused state.
      - Error test đảm bảo response/log không lộ RPC URL, API key, calldata hoặc raw provider stack.

4. **Port form và dữ liệu client**
   - Tạo `BondingPage` gồm header/contract links, wallet panel, tab Buy/Sell, form và Active Bonds.
   - Buy có toggle:
      - Exact WBTC → quote PRANA nhận dự kiến.
      - Target PRANA → quote WBTC cần trả dự kiến, kèm cảnh báo contract không nhận tham số “WBTC tối đa được phép chi”.
   - Sell nhận exact PRANA và quote WBTC dự kiến.
   - Parse chính xác tối đa 8 decimals cho WBTC, 9 cho PRANA; MAX chỉ áp dụng cho exact WBTC và Sell PRANA.
   - Term selector đọc on-chain V2 config, style như staking ui; mặc định 30 ngày nếu tồn tại, nếu không chọn option đầu tiên.
   - Quote debounce 600 ms, hủy request cũ, bỏ response stale; sau 15 giây đánh dấu quote cũ và disable submit cho tới khi refresh.
   - Không mang `BuyBondBalance`, `SellBondBalance`, `DonutChart` hoặc logic scan volume vào route mới.
   - **`maxIn` nghĩa là gì**
      - `maxIn` là giới hạn input tối đa do người dùng chấp nhận chi. Ví dụ target `10.000 PRANA`, quote hiện tại cần `0,001 WBTC`; nếu có `maxIn = 0,00101 WBTC`, contract phải revert khi giá đổi làm chi phí vượt mức đó.
      - `buyBondForPranaAmount(pranaAmount, period)` hiện chỉ nhận target PRANA và kỳ hạn, không nhận `maxWbtcIn`. Vì vậy UI không thể bắt contract giữ nguyên quote.
      - Allowance WBTC được set theo quote đóng vai trò “spending cap” thay thế: chi phí mới vượt allowance thì transaction revert thay vì lấy thêm WBTC. Đây là biện pháp giảm rủi ro, không biến quote thành slippage-protected quote.
      - Với Exact WBTC Buy và Exact PRANA Sell, giới hạn còn thiếu tương ứng là `minOut`: số PRANA/WBTC tối thiểu người dùng chấp nhận nhận. Contract hiện cũng không nhận tham số này.
   - **Kiểm thử Bước 4**
      - Parser table test cho empty/zero/negative/scientific notation, dấu thập phân lặp, 8/9 decimals hợp lệ và vượt decimals.
      - MAX dùng raw balance chính xác, không đi qua `Number`/`parseFloat`; target PRANA không hiện MAX.
      - Toggle Buy xóa hoặc vô hiệu quote của mode cũ; đổi side, term, amount, account hoặc chain cũng invalidates quote hiện tại.
      - Debounce fake-timer test: nhiều lần gõ chỉ gửi request cuối; request cũ bị abort; response về sai thứ tự không ghi đè quote mới.
      - Quote đủ 15 giây bị stale, CTA disable và fresh quote khôi phục trạng thái.
      - Term refresh loại bỏ option đang chọn thì fallback 30 ngày hoặc option đầu tiên; không submit term đã biến mất.
      - Component test đủ loading/empty/error/issue states và copy VI/EN cho cả ba quote mode.

5. **Harden approve và tạo bond**
   - Dùng một CTA theo phase: `Approve` → `Review` → `Create Bond` → `Confirming`; không tự bật hai wallet prompt liên tiếp.
   - Trước approve và trước create:
      - Refetch account/config/quote thành công.
      - Đảm bảo đúng wallet, Polygon, balance, minimum, term, paused và treasury capacity.
   - Exact WBTC Buy và Exact PRANA Sell chỉ cần allowance `>=` input cố định.
   - Target PRANA Buy phải set WBTC allowance thành cap bằng quote mới nhất, kể cả khi allowance cũ lớn hơn; nếu quote mới vượt cap thì yêu cầu approve lại. Dialog phải hiển thị cap WBTC rõ ràng.
   - Ngay trước write, chạy `simulateContract`; sau đó gửi request đã simulate bằng wallet client.
   - Khi đã có hash, retry chỉ tiếp tục `waitForTransactionReceipt`, tuyệt đối không broadcast lần hai.
   - Chỉ báo thành công sau receipt; account refetch thất bại sau receipt là warning, không biến giao dịch thành failed.
   - Chuẩn hóa lỗi VI/EN cho rejection, wrong chain, gas, allowance, pause, minimum, treasury, reserve, revert và RPC; không render raw provider error.
   - **Kiểm thử Bước 5**
      - State-machine test cho mọi phase và đảm bảo một click không tự mở cả approve lẫn create prompt.
      - Exact WBTC Buy và Exact PRANA Sell: allowance bằng input là đủ; thiếu một raw unit phải approve; allowance lớn không bị hạ không cần thiết.
      - Target PRANA: allowance cũ lớn hơn quote vẫn phải được cap lại; fresh quote vượt cap quay về approve; fresh quote nhỏ hơn/ bằng cap mới được review.
      - Thay amount/term/account/chain trước broadcast làm mất review snapshot; thay UI state sau khi đã có hash không được tạo write thứ hai.
      - User reject approve hoặc create trước hash cho phép retry đúng phase; lỗi receipt sau hash chỉ hiện “tiếp tục xác nhận”.
      - `simulateContract` failure không gọi `writeContract`; simulated request thành công phải giữ đúng address, function, args và connected account.
      - Receipt `reverted` không báo success; receipt thành công mới reset form/invalidate quote/refetch account.
      - Refetch sau success thất bại hiển thị warning và hash Polygonscan, không đổi receipt thành error.
      - Error sanitizer test với rejection, wrong chain, insufficient POL, allowance, pause, treasury/reserve và RPC secret.

6. **Port Active Bonds và claim**
   - Backend hợp nhất Buy/Sell × V1/V2; UI hiển thị badge side/version, principal, payout, claimed, claimable, thời gian và tiến độ vesting.
   - Tính claimable bằng bigint đúng công thức linear vesting; thời gian hiện tại dựa trên `blockTimestamp + elapsed`, không chỉ dựa clock thiết bị.
   - Sort theo maturity gần nhất, tie-break bằng side/version/id.
   - Claim chọn contract từ mapping nội bộ side/version, không tin địa chỉ do UI hoặc API truyền vào.
   - Claim flow: switch Polygon → simulate → write → receipt → refetch account; dùng cùng cơ chế resume pending hash.
   - Khóa form và các claim khác khi có một write đang chạy; nếu contract tương ứng paused thì disable action với lý do rõ ràng.
   - **Kiểm thử Bước 6**
      - Mapper fixtures cho bốn deployment, gồm ID trùng nhau; React key và contract dispatch vẫn phân biệt side/version.
      - Claimable bigint test tại trước creation, đúng creation, giữa kỳ, sau partial claim, đúng maturity và sau maturity; kết quả khớp phép chia Solidity.
      - Clock test dùng server `blockTimestamp + elapsed`, không nhảy theo clock máy bị lệch.
      - Sorting test theo maturity rồi side/version/id; progress luôn nằm trong `0..100`.
      - Claim V1/V2 phải chọn address/ABI từ mapping nội bộ; payload API giả mạo address không ảnh hưởng write target.
      - Paused deployment chỉ khóa đúng bond thuộc deployment đó.
      - Concurrency test: một claim pending khóa create/approve và các claim khác; resume receipt không broadcast lại.

7. **UI, accessibility và tài liệu**
   - Dùng dark shell, shader brightness thấp, `GlassPanel`, `StatusBanner`, gold CTA, Lucide và `AppFooter`; không thêm MUI hoặc PropTypes.
   - Refactor wallet control thành component dùng chung Web3 để Staking và Bonding không lặp connect/switch/disconnect.
   - Thêm VI/EN copy, metadata, Polygonscan links cho bốn deployment, responsive mobile và `prefers-reduced-motion`.
   - Term/tabs/dialog hỗ trợ keyboard, focus trap, Escape, focus-visible và `aria-live`.
   - Thêm `/guide/bonding/` VI/EN giải thích approve, hai chiều Buy, vesting, claim, treasury và giới hạn quote/slippage; thêm link footer.
   - Cập nhật Terms/Privacy để bao gồm PRANA Bonding và wallet/account/quote requests.
   - Ghi tiến độ vào `docs/add-bonding-ui.md`, cập nhật README và tài liệu shared/network architecture.
   - Sau khi mọi test pass, xóa toàn bộ `bonding-legacy-ui/`; không mang theme context, staking constants hay hooks thống kê dư thừa sang feature mới.
   - **Kiểm thử Bước 7**
      - Keyboard test cho Buy/Sell tabs và term chips: Tab, mũi tên, Enter/Space và roving `tabIndex`.
      - Dialog test: focus vào dialog khi mở, Tab không thoát, Escape đóng, đóng xong trả focus về CTA.
      - `StatusBanner` có đúng `role`, `aria-live`; input/CTA có label và disabled reason đọc được bằng screen reader.
      - Reduced-motion test/class audit: shader/decorative animation và spinner không tạo chuyển động liên tục khi user yêu cầu giảm chuyển động.
      - Responsive QA ở 320, 375, 768 và desktop: không overflow amount/hash/address, CTA full width trên mobile.
      - Copy parity test đảm bảo mọi key có cả VI/EN, không render câu trộn ngôn ngữ; metadata đổi theo locale.
      - Link test cho homepage, guide, Terms/Privacy và bốn Polygonscan deployments.
      - Sau khi xóa legacy, `rg` xác nhận không còn import/path legacy, MUI, PropTypes hoặc ThemeContext; typecheck/build lại từ clean checkout.

8. **Deployment và migration legacy**
   - Build phải tạo chunk Bonding riêng; kiểm tra Stats/Staking chunks không bị kéo thêm dependency bonding.
   - Deploy main app trước và smoke-test trực tiếp Node `/bond/` cùng các Bonding API trong khi nginx vẫn phục vụ legacy.
   - Pi nginx: bỏ redirect/static alias `/bond`, `/bond/`, `/bond/assets/` để toàn bộ route đi vào Node; chạy `nginx -t` rồi reload.
   - VPS nginx: bỏ special legacy `/bond/assets/`; giữ `/assets/` của main Vite app và reload sau `nginx -t`.
   - Public smoke-test `/bond` redirect, refresh `/bond/`, gzip assets, config/account/quote, connect/switch chain và quote; không tự gửi giao dịch thật khi smoke production.
   - Giữ `/var/www/html/prana/bond/` trong 7 ngày làm rollback; rollback bằng cách khôi phục nginx legacy blocks. Sau cửa sổ này mới xóa static build cũ và ghi nhận trong tài liệu.
   - **Kiểm thử Bước 8**
      - Trước cutover: gọi trực tiếp Node origin để test `/bond/`, ba API và hashed/gzip assets trong khi public URL vẫn chạy legacy.
      - Chạy `nginx -t` trên Pi/VPS trước mỗi reload; lưu bản config đang chạy để rollback.
      - Sau cutover: `/bond` trả đúng `308`, `/bond/` trả main SPA build identity mới, asset URL nằm dưới `/assets/`, không còn `/bond/assets/`.
      - Kiểm tra `Content-Encoding`, `Cache-Control`, CSP/security headers và `/api/version` khớp footer SHA/tag.
      - Read-only wallet smoke: connect, disconnect, switch Polygon, load account, đổi ba quote mode và refresh quote.
      - Không gửi approve/create/claim thật trong automated smoke. Transaction production chỉ chạy bằng ví test sau phê duyệt riêng.
      - Rollback drill trong cửa sổ 7 ngày: khôi phục legacy nginx blocks, xác nhận legacy `/bond/` hoạt động, rồi chuyển lại main app.



## Public interfaces

- `BondingConfig`: block metadata, V1/V2 deployments và paused state, V2 minimum/terms, token/pool addresses.
- `BondingAccount`: checksum address, block metadata, raw balances/allowances và normalized active bond records.
- `BondingQuoteRequest`: discriminated union cho ba quote mode, nhận raw amount và term ID.
- `BondingQuote`: raw PRANA/WBTC amounts, rate/duration, reserve source, quote timestamp và validation issues.
- Route công khai mới: `/bond/`, `/guide/bonding/`, `/api/bonding/config`, `/api/bonding/account`, `/api/bonding/quote`.



## Test plan

Checklist chi tiết nằm ngay dưới từng bước. Mỗi bước chỉ được đánh dấu hoàn tất khi:

- Test mới của bước đó pass độc lập và không làm regression test hiện có.
- `npm run typecheck` pass; các bước backend/client tương ứng phải chạy thêm server/client test suite.
- Cuối Bước 7 chạy toàn bộ `npm test`, `npm run test:staking`, `npm run test:bonding` và production build.
- Cuối Bước 8 hoàn tất smoke test origin/public, ghi lại build SHA, kết quả nginx validation và quyết định giữ/rollback.



## Giả định đã khóa

- Canonical route tiếp tục là `/bond/` để không đổi URL production hiện tại.
- Chỉ tạo bond mới trên V2; V1 tồn tại để xem và claim lịch sử.
- Giữ cả hai chiều nhập của Buy Bond theo lựa chọn của bạn.
- Bỏ donut/status panels vì dữ liệu đã có trên homepage.
- Không sửa hoặc redeploy smart contract; do đó UI không tuyên bố slippage protection mà contract không thể enforce.
