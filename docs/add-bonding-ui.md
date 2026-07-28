# Tích hợp Bonding UI vào main app tại `/bond/`

## Tóm tắt

- Template song song: [`docs/add-staking-ui.md`](./add-staking-ui.md) — lazy route, API, CTA phases, guide stack và deployment.
- legacy bonding ui nằm ở thư mục `bonding-legacy-ui/`. Sau khi làm làm xong hết kế hoạch trong file này thì có thể xoá.
- Chuyển bonding legacy thành lazy feature TypeScript trong main Vite app, dùng chung Web3 providers, React Query, VI/EN, footer và design system.
- Giữ Buy/Sell Bond V2, quản lý và claim bond V1/V2; bỏ các donut/status trùng với Bonding Stats trên homepage.
- Buy Bond giữ hai chế độ nhập: WBTC chính xác hoặc target PRANA.
- Contract reads, quote và fallback xác nhận receipt đi qua backend; ví chỉ trực tiếp gửi `approve`, tạo bond và `claim`.
- Quote được tính đúng theo trạng thái on-chain tại block đọc. Nếu reserves/rates/treasury không đổi trước khi transaction thực thi thì raw amount sẽ khớp quote; thời gian trôi qua hoặc sang block mới tự nó không làm quote đổi. UI vẫn fresh-quote/preflight trước giao dịch vì contract không nhận ngưỡng output tối thiểu (`minOut`) hoặc input tối đa (`maxIn`) để khóa kết quả khi state thực sự thay đổi.



## Các bước triển khai

1. ✅ **Thiết lập lazy route** `/bond/`
  - Thêm `BOND_PATH`, `BOND_CANONICAL_PATH`, `isBondPath` vào `constants/appRoutes.ts` (mirror `STAKE_*` / `isStakePath`).
  - Cấu trúc entry giống Staking:
    - `features/bonding/BondingEntry.tsx` bọc `pages/BondingPage.tsx` bằng `Web3Providers`.
    - `React.lazy` trong `main.tsx` trên nhánh `isBondPath`, **ngoài** homepage shader shell (như `isStakePath`).
  - Node redirect `/bond` → `/bond/` bằng `308`, giữ query string; `/bond/*` trả SPA shell qua `server/staticRoutes.ts`.
  - Chuyển Hero BOND trong `hero3.tsx` từ URL tuyệt đối + `target="_blank"` sang `BOND_CANONICAL_PATH` same-tab (giống STAKE).
  - Đảm bảo vào `/bond/` không tải `StatsPage`, GLB hoặc dữ liệu homepage.
  - **Kiểm thử Bước 1**
    - Unit test `isBondPath`: nhận `/bond`, `/bond/`, `/bond/preview`; từ chối `/bonding`, `/bonds` và `/`.
    - Server route test (`server/tests/bondRoutes.test.ts`, mirror `stakeRoutes.test.ts`): `/bond?ref=hero` trả `308` tới `/bond/?ref=hero`; refresh `/bond/` và `/bond/*` đều trả fixture SPA shell.
    - Test Hero dùng constant canonical same-tab thay vì URL production hardcode / tab mới.
    - Production build phải có chunk `BondingEntry`/`BondingPage` riêng. Kiểm tra chunk entry chung và `StatsPage` không import module bonding.
    - Chạy trang `/bond/` với network log sạch: không có request tới JSON stats, model GLB hoặc chunk `StatsPage`.
2. ✅ **Chuẩn hóa constants, ABI và types**
  - Mở rộng `constants/bonds.ts` (và `bonds.types.ts`) — file đã có địa chỉ V1/V2 + ABI scan/`committed*`; **không tạo file ABI thứ hai**.
  - Bổ sung ABI tối thiểu còn thiếu: create bond (chỉ V2), active-bond read, `claimBond`, config/paused/min/terms reads. Giữ pattern `BondAbiFunctionFragment[]` hiện có, hoặc migrate sang `as const` như `stakingContracts.ts` nếu typecheck yêu cầu.
  - Chỉ giữ V2 ABI cho tạo bond; V1/V2 đều có read active bonds và `claimBond`.
  - Dùng lại PRANA/WBTC address, decimals, pool và network constants hiện tại; không sao chép constants từ legacy.
  - Tạo `features/bonding/bonding.types.ts` cho term, config, account, quote, active bond và transaction lifecycle (một file, như `staking.types.ts`).
  - Token amounts, allowance và bond ID đi qua JSON dưới dạng decimal string; không ép sang `number`.
  - **Kiểm thử Bước 2**
    - Typecheck xác nhận tên hàm và tuple V1/V2 khớp với `readContract`, `simulateContract` và `writeContract`.
    - Characterization test so sánh bốn địa chỉ deployment, token decimals và pool address với constants legacy trước khi xóa legacy.
    - ABI contract test xác nhận V1 chỉ cần active-bond read/claim, còn create functions chỉ trỏ V2.
    - Test mapper với amount và bond ID lớn hơn `Number.MAX_SAFE_INTEGER`; JSON vẫn giữ đúng decimal string.
    - Static search không còn address literal hoặc bản ABI thứ hai trong `features/bonding`, server loader và UI.
3. ✅ **Xây backend Bonding API**
  - Loaders: `server/loaders/bondingConfig.ts`, `bondingAccount.ts`, `bondingQuote.ts`, `bondingTransactionConfirmation.ts` (+ optional `server/loaders/cached/bondingConfigCached.ts`); đăng ký trong `getApiRoutes.ts` / `postApiRoutes.ts`.
  - Tạo `server/utils/bondingReadUtils.ts` cho term mapping, active-bond normalization và quote math dùng chung giữa loaders/tests; route files chỉ orchestration.
  - Trong `getApiRoutes.ts`, thêm injectable `BondingApiLoaders` + default loaders giống `StakingApiLoaders` để route tests không cần live RPC.
  - Rate limit: mở rộng factory `createSwapRateLimiters()` hiện có trong `server/rateLimit.ts` (factory này đã chứa Staking limiter) bằng bonding quote/account/confirmation limiters; không tạo rate-limit store riêng.
  - `GET /api/bonding/config`: cache private 30 giây; trả chain/block, trạng thái paused của bốn deployment, min Buy/Sell, term/rate/duration V2 và địa chỉ contract/token.
  - `GET /api/bonding/account?address=…`: `private, no-store`; trả PRANA/WBTC balance, allowance cho hai V2 contract và active Buy/Sell bonds từ cả V1/V2.
  - `POST /api/bonding/quote`: `no-store`; request là union `buy_exact_wbtc`, `buy_target_prana` hoặc `sell_exact_prana`, gồm `amountRaw` và `termId`.
  - `POST /api/bonding/confirm-transaction`: `no-store`; fallback qua Polygon RPC của server khi browser RPC không đọc được receipt của hash đã broadcast.
    - Request gồm `transactionHash`, connected `account` và action snapshot tối thiểu (`approve|create|claim`, side/version và args cần đối chiếu).
    - Chỉ xác nhận sau khi receipt terminal; kiểm tra sender, chain, target từ mapping nội bộ, function selector và args tương ứng. Không tin contract address hoặc calldata do client tự khai.
    - Endpoint này chỉ dự phòng xác nhận UX, không ghi trusted analytics hay tạo side effect; vì vậy không tái dùng HMAC hoặc `/api/swap/verify-transaction` riêng của Swap.
  - Quote response trả `wbtcAmountRaw`, `pranaAmountRaw`, rate/duration, block timestamp, nguồn reserve `impacted|market` và các issue như paused, dưới minimum, vượt reserve hoặc thiếu treasury.
  - Mọi reads trong một response dùng cùng `blockTag`; quote mô phỏng đúng thứ tự bigint/rounding/1% fee của Solidity và nhánh tự đồng bộ market reserve.
  - Validate body/content-type/origin, giới hạn body 2 KB, 10 quote/IP/phút + 60 toàn server/phút; account dùng 10/IP + 120 toàn server/phút; confirmation có bucket riêng để hash polling không tiêu quota quote. Tái dùng `rejectInvalidSwapApiRequest` từ `server/helpers/apiRoutesHelpers.ts` và `readJsonBody()` từ `server/helpers/requestHelpers.ts`.
  - Lỗi RPC trả `502` đã redact; input sai trả `400`; trạng thái quote không executable vẫn trả `200` kèm issue để form hiển thị đúng lý do.
  - **Vì sao Bonding có body/content-type/origin validation và confirmation fallback**
    - Hai Staking endpoint hiện tại đều là `GET`. Chúng không nhận JSON body, nên không có body size hoặc `Content-Type` để kiểm tra. Staking vẫn validate method, checksum `address`, rate limit và redact lỗi RPC.
    - Bonding config/account cũng là `GET` và áp dụng cùng mô hình với Staking.
    - Bonding quote là `POST` vì request có discriminated union và raw amount. Endpoint này phải giới hạn 2 KB, yêu cầu JSON và reject body sai shape để tránh parser/memory abuse hoặc RPC calls vô nghĩa.
    - Confirmation cũng là `POST` vì cần hash + action snapshot. Nó chỉ được gọi sau khi browser `waitForTransactionReceipt` lỗi; server dùng RPC độc lập để phân biệt transaction success/revert với lỗi đọc RPC tạm thời.
    - Origin validation ở các POST là lớp chống website khác dùng trình duyệt người dùng để tiêu quota RPC của PRANA; đây không phải cơ chế xác thực tuyệt đối vì client ngoài trình duyệt có thể tự đặt header. Rate limit và strict input validation vẫn là lớp bảo vệ chính.
    - Swap `/api/swap/verify-transaction` còn kiểm HMAC, router calldata và ghi verified analytics vì backend tạo route/calldata động. Bonding không tái dùng flow đó: server chỉ cho phép mapping contract/function cố định và xác nhận receipt/action đã broadcast.
  - **Kiểm thử Bước 3**
    - Config: chỉ nhận `GET`, trả cache 30 giây, đúng bốn paused state/terms/minimum và mọi read dùng cùng `blockTag`.
    - Account: thiếu/sai address trả `400` trước khi tiêu rate-limit quota; address hợp lệ được checksum; response có `private, no-store`.
    - Account mapper: hợp nhất đủ Buy/Sell × V1/V2, không làm rơi bond khi ID trùng giữa deployment, và hard-fail `502` thay vì trả danh sách thiếu nếu một contract read lỗi.
    - Quote method/content: non-POST trả `405`; content type không phải JSON, body rỗng, JSON lỗi, body trên 2 KB hoặc union sai đều bị từ chối mà không gọi loader/RPC.
    - Quote origin: same-origin hợp lệ được nhận; browser origin không được phép bị từ chối; request không có `Origin` từ server-to-server được xử lý theo cùng policy hiện có của Swap.
    - Rate-limit test riêng cho quote/account/confirmation, gồm per-IP, global bucket, trusted proxy hop và cleanup bucket.
    - Quote math fixture cho cả ba mode; kiểm tra đúng nhánh `impacted`/`market`, 1% fee, basis points, thứ tự chia bigint và rounding xuống như Solidity.
    - Boundary fixtures: zero, dưới minimum, term ngoài `0..4`, target bằng/vượt reserve, treasury vừa đủ/thiếu một raw unit và paused state.
    - Error test đảm bảo response/log không lộ RPC URL, API key, calldata hoặc raw provider stack.
    - Confirmation API test: reject body/hash/action sai trước RPC; success/revert/not-mined/RPC-error tách biệt; sender/target/function/args mismatch không được xác nhận.
    - Suite: `server/tests/bondingApi.test.ts` (mirror `stakingApi.test.ts`).
4. ✅ **Port form và dữ liệu client**
  - Cấu trúc client mirror Staking:
    - `pages/BondingPage.tsx` — shell (shader, `LanguageToggle`, `AppFooter`, `usePageMetadata`, header/links).
    - `features/bonding/bondingApi.ts` — browser adapter qua `fetchJson` (mirror `stakingApi.ts`).
    - `features/bonding/bonding.copy.ts` — VI/EN copy.
    - `features/bonding/components/` — form, tabs, Active Bonds, term selector.
    - `features/bonding/hooks/` — config/account/quote hooks.
  - Tái dùng constants từ `constants/sharedContracts.ts`: `WBTC_ADDRESS`, `WBTC_DECIMALS`, `PRANA_ADDRESS`, `PRANA_DECIMALS`, `WBTC_PRANA_V3_POOL`.
  - Trước khi Bonding dùng wallet UI, hoàn thành các shared refactor cần thiết:
    - Chuyển `getPolygonWalletClient.ts` từ `features/staking/` sang `features/web3/`; luôn lấy client mới sau `ensurePolygon()`, không dùng client capture trước chain switch.
    - Chuyển `TxLink.tsx` trung lập từ `features/staking/components/` sang `components/ui/` để Staking/Bonding cùng dùng Polygonscan hash link.
    - Tách phần UI connect / switch Polygon / disconnect của `features/staking/components/WalletControl.tsx` sang `features/web3/`; copy và error formatter được truyền từ từng feature.
    - Mirror gate trong `features/staking/accountRefetch.ts` bằng helper Bonding typed riêng; không import `StakingAccountSnapshot` vào Bonding và không fallback sang cached account trước write.
  - Buy có toggle:
    - Exact WBTC → quote PRANA nhận dự kiến.
    - Target PRANA → quote WBTC cần trả dự kiến, kèm cảnh báo contract không nhận tham số “WBTC tối đa được phép chi”.
  - Sell nhận exact PRANA và quote WBTC dự kiến.
  - Parse chính xác tối đa 8 decimals cho WBTC, 9 cho PRANA; MAX chỉ áp dụng cho exact WBTC và Sell PRANA.
  - Term selector đọc on-chain V2 config; mirror `features/staking/components/DurationSelector.tsx` (chip grid, roving `tabIndex`, keyboard); mặc định 30 ngày nếu tồn tại, nếu không chọn option đầu tiên.
  - Quote debounce 600 ms, hủy request cũ, bỏ response stale; sau 30 giây đánh dấu quote cũ. Khi user bấm CTA, app tự fresh-quote trước khi review/write thay vì bắt refresh thủ công; nếu raw amount không đổi thì tiếp tục bình thường.
  - Không mang `BuyBondBalance`, `SellBondBalance`, `DonutChart` hoặc logic scan volume vào route mới.
  - `maxIn` **nghĩa là gì**
    - `maxIn` là giới hạn input tối đa do người dùng chấp nhận chi. Ví dụ target `10.000 PRANA`, quote hiện tại cần `0,001 WBTC`; nếu có `maxIn = 0,00101 WBTC`, contract phải revert khi giá đổi làm chi phí vượt mức đó.
    - `buyBondForPranaAmount(pranaAmount, period)` hiện chỉ nhận target PRANA và kỳ hạn, không nhận `maxWbtcIn`. Vì vậy UI không thể bắt contract giữ nguyên quote.
    - Chỉ **Target PRANA Buy** cần allowance WBTC làm “spending cap” thay thế: chi phí WBTC tính lại lúc execution mà vượt allowance thì transaction revert thay vì lấy thêm WBTC. Nếu chi phí bằng hoặc thấp hơn cap thì contract dùng số thực tế đó.
    - **Exact WBTC Buy** luôn dùng đúng số WBTC truyền vào `buyBondForWbtcAmount`; không có rủi ro chi nhiều WBTC hơn input. Giá trị có thể thay đổi là lượng PRANA nhận, vì contract không nhận `minPranaOut`.
    - **Exact PRANA Sell** luôn dùng đúng số PRANA truyền vào `sellBond`; giá trị có thể thay đổi là lượng WBTC nhận, vì contract không nhận `minWbtcOut`.
    - Với volume/traffic Bonding hiện thấp, hầu hết quote sẽ khớp chính xác khi execution. Sai khác chỉ xuất hiện nếu state liên quan đổi giữa lúc quote và lúc transaction được thực thi, ví dụ có bond khác, giao dịch làm đổi WBTC/PRANA pool, hoặc manager cập nhật/sync contract.
  - **Kiểm thử Bước 4**
    - Parser table test cho empty/zero/negative/scientific notation, dấu thập phân lặp, 8/9 decimals hợp lệ và vượt decimals.
    - MAX dùng raw balance chính xác, không đi qua `Number`/`parseFloat`; target PRANA không hiện MAX.
    - Toggle Buy xóa hoặc vô hiệu quote của mode cũ; đổi side, term, amount, account hoặc chain cũng invalidates quote hiện tại.
    - Debounce fake-timer test: nhiều lần gõ chỉ gửi request cuối; request cũ bị abort; response về sai thứ tự không ghi đè quote mới.
    - Quote đủ 30 giây bị đánh dấu stale; bấm CTA phải tự fresh-quote. Quote không đổi tiếp tục flow, quote đổi cập nhật review/cap trước khi cho write.
    - Determinism test: cùng reserves/rates/treasury và input phải cho đúng cùng raw quote dù block timestamp khác; chỉ fixture thay đổi state mới được làm quote đổi.
    - Term refresh loại bỏ option đang chọn thì fallback 30 ngày hoặc option đầu tiên; không submit term đã biến mất.
    - Component test đủ loading/empty/error/issue states và copy VI/EN cho cả ba quote mode.
5. ✅ **Harden approve và tạo bond**
  - Template Staking: `stakeCtaPhase.ts`, `useStakeTransaction.ts`, `stakeTransactionFlow.ts` → tương ứng Bonding `bondCtaPhase` / transaction hook/flow (approve+create thay vì permit+stake).
  - Template confirmation mới từ v4.4.0: tách helper thuần `features/bonding/utils/bondTransactionConfirmation.ts` tương tự `features/swap/utils/swapTransactionConfirmation.ts`; hook chỉ orchestration/UI state.
  - Dùng một CTA theo phase: `Approve` → `Review` → `Create Bond` → `Confirming`; không tự bật hai wallet prompt liên tiếp.
  - Bốn phase là trạng thái UI, không phải bốn yêu cầu ký trên ví:
    - `Approve`: nếu allowance chưa phù hợp, user bấm CTA và xác nhận một transaction `approve` trên ví.
    - `Review`: app fresh-quote rồi mở dialog review nội bộ; không gọi ví.
    - `Create Bond`: user xác nhận dialog, sau đó ví hiện một transaction tạo bond.
    - `Confirming`: app chờ receipt; không gọi ví và không ký thêm.
  - Vì vậy flow cần approval có tối đa hai wallet transaction prompts, xuất hiện ở hai hành động chủ động riêng. Nếu allowance đã đủ thì bỏ qua `Approve` và chỉ còn prompt tạo bond. `simulateContract`, fresh quote và chờ receipt đều không mở ví.
  - Trước approve và trước create:
    - Refetch account/config/quote thành công.
    - Đảm bảo đúng wallet, Polygon, balance, minimum, term, paused và treasury capacity.
  - Exact WBTC Buy và Exact PRANA Sell chỉ cần allowance `>=` input cố định.
  - Target PRANA Buy phải set WBTC allowance thành cap bằng quote mới nhất, kể cả khi allowance cũ lớn hơn; nếu quote mới vượt cap thì yêu cầu approve lại. Dialog phải hiển thị cap WBTC rõ ràng.
  - Ngay trước write, chạy `simulateContract`; sau đó gửi request đã simulate bằng wallet client.
  - Khi đã có hash, tuyệt đối không broadcast lần hai:
    - Thử `waitForTransactionReceipt` qua browser RPC trước.
    - Nếu browser RPC lỗi đọc receipt, gọi `/api/bonding/confirm-transaction` qua RPC server độc lập.
    - Receipt explicit `reverted` mới là transaction failed; RPC lỗi hoặc transaction chưa terminal không được đổi thành failed.
    - Nếu cả browser và server chưa xác nhận được, giữ hash + snapshot, chuyển phase `Confirmation unavailable`, hiện Polygonscan và CTA “Tiếp tục xác nhận”; retry chỉ lặp confirmation.
  - Chỉ báo thành công sau receipt; account refetch thất bại sau receipt là warning, không biến giao dịch thành failed.
  - Chuẩn hóa lỗi VI/EN cho rejection, wrong chain, gas, allowance, pause, minimum, treasury, reserve, revert và RPC; không render raw provider error.
  - **Kiểm thử Bước 5**
    - State-machine test cho mọi phase: flow cần approval có đúng hai wallet prompts tách biệt; flow đủ allowance có đúng một prompt; Review/Confirming/simulate/fresh-quote không gọi ví.
    - Đảm bảo một click không tự mở cả approve lẫn create prompt.
    - Exact WBTC Buy và Exact PRANA Sell: allowance bằng input là đủ; thiếu một raw unit phải approve; allowance lớn không bị hạ không cần thiết.
    - Target PRANA: allowance cũ lớn hơn quote vẫn phải được cap lại; fresh quote vượt cap quay về approve; fresh quote nhỏ hơn/ bằng cap mới được review.
    - Thay amount/term/account/chain trước broadcast làm mất review snapshot; thay UI state sau khi đã có hash không được tạo write thứ hai.
    - User reject approve hoặc create trước hash cho phép retry đúng phase; lỗi receipt sau hash chỉ hiện “tiếp tục xác nhận”.
    - Browser receipt success không gọi server fallback; browser RPC lỗi + server success/revert trả đúng terminal state.
    - Browser và server cùng unavailable giữ `Confirmation unavailable`, hash và action snapshot; không log/render như transaction failed và không gọi write lần hai.
    - `simulateContract` failure không gọi `writeContract`; simulated request thành công phải giữ đúng address, function, args và connected account.
    - Receipt `reverted` không báo success; receipt thành công mới reset form/invalidate quote/refetch account.
    - Refetch sau success thất bại hiển thị warning và hash Polygonscan, không đổi receipt thành error.
    - Error sanitizer test với rejection, wrong chain, insufficient POL, allowance, pause, treasury/reserve và RPC secret.
6. ✅ **Port Active Bonds và claim**
  - Backend hợp nhất Buy/Sell × V1/V2; UI hiển thị badge side/version, principal, payout, claimed, claimable, thời gian và tiến độ vesting.
  - Tính Bonding claimable bằng bigint đúng contract:
    - Trước maturity: `totalVestedRaw = floor(totalPayoutRaw × (now - creationTime) / (maturityTime - creationTime))`.
    - `claimableRaw = max(totalVestedRaw - claimedRaw, 0)`.
    - Từ maturity: claim toàn bộ `totalPayoutRaw - claimedRaw` còn lại và contract đánh dấu bond đã claimed.
    - `lastClaimTime` của Bonding chỉ chặn hai claim cùng timestamp; công thức vesting vẫn tính cộng dồn từ `creationTime` rồi trừ `claimedRaw`.
  - **Khác biệt cốt lõi giữa Bonding và Staking**
    - Cả hai đều dùng timestamp theo giây, nhưng không dùng cùng điểm bắt đầu để tính claimable.
    - Bonding tính tổng payout đã vest cộng dồn từ `creationTime`, sau đó trừ tổng payout đã claim:
      ```text
      totalVestedRaw = floor(totalPayoutRaw × elapsedSinceCreation / totalDuration)
      claimableRaw = totalVestedRaw - claimedRaw
      ```
    - Staking tính phần lãi mới phát sinh từ `lastClaimTime`, sau khi cap thời gian tại maturity:
      ```text
      effectiveTime = min(now, startTime + duration)
      elapsedSinceLastClaim = effectiveTime - lastClaimTime
      annualInterestRaw = floor(principalRaw × APR / 100)
      interestPerSecondRaw = floor(annualInterestRaw / 31,536,000)
      claimableInterestRaw = interestPerSecondRaw × elapsedSinceLastClaim
      ```
    - Vì vậy `lastClaimTime` trong Staking trực tiếp quyết định số lãi của lần claim tiếp theo. Trong Bonding, nó được lưu và cập nhật sau claim nhưng không tham gia công thức payout; `claimedPrana` hoặc `claimedWbtc` mới là giá trị được trừ khỏi tổng đã vest.
    - Ví dụ một Buy Bond có payout `1.000 PRANA` vest trong 100 ngày:
      - Ngày 30: tổng đã vest là `300 PRANA`; nếu chưa claim thì claimable là `300 PRANA`.
      - Sau khi claim, `claimedPrana = 300 PRANA` và `lastClaimTime` được cập nhật.
      - Ngày 50: tổng đã vest là `500 PRANA`; claimable mới là `500 - 300 = 200 PRANA`.
      - Từ ngày 100: contract trả toàn bộ `1.000 - claimedPrana` còn lại rồi đánh dấu bond `claimed = true`.
  - Progress bar Bonding là phần trăm payout đã vest theo thời gian: clamp `floor((now - creationTime) × 100 / (maturityTime - creationTime))` vào `0..100`. Nó có cùng hình dạng với progress thời gian tới maturity của Staking, nhưng không phải công thức tính lãi Staking.
  - Thời gian hiện tại dựa trên `blockTimestamp + elapsed`, không chỉ dựa clock thiết bị.
  - Sort theo maturity gần nhất, tie-break bằng side/version/id.
  - Claim chọn contract từ mapping nội bộ side/version, không tin địa chỉ do UI hoặc API truyền vào.
  - Claim flow: switch Polygon → simulate → write → browser receipt / server confirmation fallback → refetch account; dùng cùng cơ chế resume pending hash.
  - Khóa form và các claim khác khi có một write đang chạy; nếu contract tương ứng paused thì disable action với lý do rõ ràng.
  - **Kiểm thử Bước 6**
    - Mapper fixtures cho bốn deployment, gồm ID trùng nhau; React key và contract dispatch vẫn phân biệt side/version.
    - Claimable bigint test tại trước creation, đúng creation, giữa kỳ, sau partial claim, đúng maturity và sau maturity; kết quả khớp phép chia Solidity.
    - Progress test clamp `0..100`, rounding xuống theo integer math và tách biệt khỏi `lastClaimTime`.
    - Multi-claim test: claim ngày 30 rồi ngày 50 phải trả phần chênh lệch cumulative vested (`500 - 300` trong ví dụ), không vest lại từ `lastClaimTime`.
    - Regression test phân biệt Bonding và Staking: thay `lastClaimTime` nhưng giữ `claimedRaw` không được làm đổi Bonding claimable; cùng thay đổi đó phải làm đổi Staking claimable interest.
    - Clock test dùng server `blockTimestamp + elapsed`, không nhảy theo clock máy bị lệch.
    - Sorting test theo maturity rồi side/version/id; progress luôn nằm trong `0..100`.
    - Claim V1/V2 phải chọn address/ABI từ mapping nội bộ; payload API giả mạo address không ảnh hưởng write target.
    - Paused deployment chỉ khóa đúng bond thuộc deployment đó.
    - Concurrency test: một claim pending khóa create/approve và các claim khác; resume receipt không broadcast lại.
7. ✅ **UI, accessibility và tài liệu**
  - Dùng dark shell, shader brightness thấp, `GlassPanel`, `StatusBanner`, gold CTA, Lucide và `AppFooter`; không thêm MUI hoặc PropTypes.
  - Xác nhận shared wallet control / `TxLink` đã được cả Staking và Bonding dùng sau refactor ở Bước 4; không còn import ngược từ Bonding vào `features/staking/`.
  - Thêm VI/EN copy, metadata, Polygonscan links cho bốn deployment, responsive mobile và `prefers-reduced-motion`.
  - Term/tabs/dialog hỗ trợ keyboard, focus trap, Escape, focus-visible và `aria-live`.
  - Thêm hai trang guide riêng, mirror Staking (`/guide/staking/` + `/guide/staking-contracts/`):
    1. **User guide** `/guide/bonding/` — approve, hai chiều Buy, Sell, vesting, claim, treasury và giới hạn quote/slippage.
    2. **Contracts guide** `/guide/bonding-contracts/` — giải thích on-chain `BuyPranaBondV2` và `SellPranaBondV2` (educational; luôn đối chiếu code/params trên Polygonscan).
  - Pattern render giống Staking/Swap guides sau rename trên `main` (không dùng `LegalMarkdownPage` hay `termsRiskParser` cũ):
    - Constants trong `constants/appRoutes.ts`:
      - `GUIDE_BONDING_PATH`, `GUIDE_BONDING_CANONICAL_PATH`, `isGuideBondingPath`
      - `GUIDE_BONDING_CONTRACTS_PATH`, `GUIDE_BONDING_CONTRACTS_CANONICAL_PATH`, `isGuideBondingContractsPath`
    - Pages: `components/BondingGuidePage.tsx`, `components/BondingContractsGuidePage.tsx` qua `MarkdownDocumentPage`.
    - Hooks: `hooks/useBondingGuideDocument.ts`, `hooks/useBondingContractsGuideDocument.ts` qua `parseSectionedMarkdown`.
    - Nội dung:
      - `data/guide-bonding-{en,vi}.md`
      - `data/guide-bonding-contracts-{en,vi}.md` (mirror `data/guide-staking-contracts-{en,vi}.md`)
    - Cập nhật `GUIDE_UPDATED_DATE` trong `constants/guides.ts` khi publish guide.
    - Đăng ký cả hai route trong `main.tsx` bên trong homepage/legal shell giống `StakingGuidePage` / `ContractsGuidePage`, không đặt trong lazy `BondingEntry`; bare → canonical `308` + SPA shell trong `server/staticRoutes.ts`.
    - Test matcher/redirect/SPA cho cả hai path trong `server/tests/guideRoutes.test.ts`.
    - Footer: thêm `GUIDE_BONDING_CANONICAL_PATH` vào `AppFooter` (user guide). Contracts guide không bắt buộc vào footer; đặt trong header Bonding page như staking.
    - Header `pages/BondingPage.tsx`: Polygonscan links cho bốn deployment + same-site link tới `GUIDE_BONDING_CONTRACTS_CANONICAL_PATH` (mirror `StakingPage` → `/guide/staking-contracts/`).
    - Cross-link: user guide ↔ contracts guide ↔ `/terms`; contracts guide nêu rõ V1 chỉ còn để xem/claim lịch sử, bond mới chỉ trên V2.
  - Nội dung tối thiểu cho `/guide/bonding-contracts/` (dựa trên `contracts/BuyPranaBondV2.sol` và `contracts/SellPranaBondV2.sol`):
    - Big picture: hai contract độc lập — Buy nhận WBTC / trả PRANA vesting; Sell nhận PRANA / trả WBTC vesting.
    - Impacted reserves và progressive price impact; `syncImpactedReserves` / `setImpactedReserves` thuộc manager.
    - Buy: `buyBondForWbtcAmount` vs `buyBondForPranaAmount`; không có `minPranaOut` / `maxWbtcIn`.
    - Sell: `sellBond(pranaAmount, period)`; không có `minWbtcOut`.
    - Phí 1% trong quote math; term/rate/duration từ `bondRates`; minimum Buy/Sell.
    - Claim/vesting từ `creationTime`, `claimedPrana`/`claimedWbtc`, và `lastClaimTime` chỉ chặn double-claim cùng timestamp.
    - Pause, treasury/committed amounts, và quyền `BOND_MANAGER_ROLE` / `DEFAULT_ADMIN_ROLE` (rates, min, reserves, withdraw, pause) — gì owner/manager làm được và không làm được với bond đã tạo.
    - Không tái dùng path/file của staking contracts guide.
  - Cập nhật Terms/Privacy để bao gồm PRANA Bonding và wallet/account/quote/transaction-confirmation requests.
    - Nội dung: `data/terms-risk-{en,vi}.md`, `data/privacy-{en,vi}.md` (render qua `MarkdownDocumentPage` + `parseSectionedMarkdown`).
    - Nếu thay đổi pháp lý chính thức: cập nhật ngày trong `constants/termsRisk.ts` và `constants/privacy.ts`.
  - Sau khi các phần Bonding tương ứng đã tồn tại, ghi tiến độ vào `docs/add-bonding-ui.md`; cập nhật README và tài liệu architecture sẽ trở nên lỗi thời khi Bonding dùng Web3 chung:
    - `docs/SHARED_CODE_ARCHITECTURE.md` và `docs/vi/SHARED_CODE_ARCHITECTURE.md`
    - `docs/swap-modal-technical-overview.md` và `docs/vi/swap-modal-technical-overview.md`
    - `docs/NETWORK_ARCHITECTURE.md` và `docs/vi/NETWORK_ARCHITECTURE.md`
    - `docs/SECURITY_OVERVIEW.md` và `docs/vi/SECURITY_OVERVIEW.md` — fixed action validation, origin/body/rate-limit và confirmation fallback
    - `docs/CACHE_ARCHITECTURE.md` — config cache, account/quote/confirmation `no-store` và React Query keys
    - Comment “Swap and staking only” trong `features/web3/Web3Providers.tsx`, `useInjectedWallet.ts`, `walletFormatting.ts` và `main.tsx`
  - Sau khi mọi test pass, xóa toàn bộ `bonding-legacy-ui/`; không mang theme context, staking constants hay hooks thống kê dư thừa sang feature mới.
  - **Kiểm thử Bước 7**
    - Keyboard test cho Buy/Sell tabs và term chips: Tab, mũi tên, Enter/Space và roving `tabIndex`.
    - Dialog test: focus vào dialog khi mở, Tab không thoát, Escape đóng, đóng xong trả focus về CTA.
    - `StatusBanner` có đúng `role`, `aria-live`; input/CTA có label và disabled reason đọc được bằng screen reader.
    - Reduced-motion test/class audit: shader/decorative animation và spinner không tạo chuyển động liên tục khi user yêu cầu giảm chuyển động.
    - Responsive QA ở 320, 375, 768 và desktop: không overflow amount/hash/address, CTA full width trên mobile.
    - Copy parity test đảm bảo mọi key có cả VI/EN, không render câu trộn ngôn ngữ; metadata đổi theo locale.
    - Link test cho homepage, `/guide/bonding/`, `/guide/bonding-contracts/`, Terms/Privacy và bốn Polygonscan deployments.
    - Guide route test: `/guide/bonding` và `/guide/bonding-contracts` → `308` canonical; refresh cả hai trả SPA shell; page render đúng VI/EN qua `MarkdownDocumentPage`.
    - Guide metadata/header test: dùng `GUIDE_UPDATED_DATE`; Bonding page header có same-site link tới contracts guide; guide routes không kéo `BondingEntry`/Web3.
    - Shared wallet control/TxLink: Staking và Bonding cùng dùng component trung lập; copy/error format vẫn feature-local; không có import Bonding → Staking.
    - Sau khi xóa legacy, `rg` xác nhận không còn import/path legacy, MUI, PropTypes hoặc ThemeContext; typecheck/build lại từ clean checkout.
8. **Deployment và migration legacy**
  - Build phải tạo chunk Bonding riêng; kiểm tra Stats/Staking chunks không bị kéo thêm dependency bonding.
  - Deploy main app trước và smoke-test trực tiếp Node `/bond/` cùng các Bonding API trong khi nginx vẫn phục vụ legacy.
  - Pi nginx: bỏ redirect/static alias `/bond`, `/bond/`, `/bond/assets/` để toàn bộ route đi vào Node; chạy `nginx -t` rồi reload.
  - Lưu ý: Pi legacy hiện dùng `301` cho `/bond` → `/bond/`; sau cutover Node phục vụ bare path bằng `308` (đồng bộ với `/stake` và guides).
  - VPS nginx: bỏ special legacy `/bond/assets/`; giữ `/assets/` của main Vite app và reload sau `nginx -t`.
  - Public smoke-test `/bond` redirect, refresh `/bond/`, gzip assets, config/account/quote/confirmation route validation, connect/switch chain và quote; không tự gửi giao dịch thật khi smoke production.
  - Giữ `/var/www/html/prana/bond/` trong 7 ngày làm rollback; rollback bằng cách khôi phục nginx legacy blocks. Sau cửa sổ này mới xóa static build cũ và ghi nhận trong tài liệu.
  - **Kiểm thử Bước 8**
    - Trước cutover: gọi trực tiếp Node origin để test `/bond/`, bốn API và hashed/gzip assets trong khi public URL vẫn chạy legacy.
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
- `BondingTransactionConfirmationRequest`: hash, account và action snapshot tối thiểu để server đối chiếu fixed target/function/args.
- `BondingTransactionConfirmation`: terminal `confirmed|reverted`, hoặc trạng thái chưa thể xác nhận mà không suy diễn thành on-chain failure.
- Route công khai mới: `/bond/`, `/guide/bonding/`, `/guide/bonding-contracts/`, `/api/bonding/config`, `/api/bonding/account`, `/api/bonding/quote`, `/api/bonding/confirm-transaction`.
- Route constants mới: `BOND_PATH`, `BOND_CANONICAL_PATH`, `isBondPath`, `GUIDE_BONDING_PATH`, `GUIDE_BONDING_CANONICAL_PATH`, `isGuideBondingPath`, `GUIDE_BONDING_CONTRACTS_PATH`, `GUIDE_BONDING_CONTRACTS_CANONICAL_PATH`, `isGuideBondingContractsPath`.



## Test plan

Checklist chi tiết nằm ngay dưới từng bước. Mỗi bước chỉ được đánh dấu hoàn tất khi:

- Test mới của bước đó pass độc lập và không làm regression test hiện có.
- `npm run typecheck` pass; các bước backend/client tương ứng phải chạy thêm server/client test suite.
- Thêm script `"test:bonding": "node --import tsx --test 'features/bonding/tests/**/*.test.ts'"` vào `package.json` (mirror `test:staking`).
- Cuối Bước 7 chạy toàn bộ `npm test`, `npm run test:staking`, `npm run test:bonding` và production build.
- Cuối Bước 8 hoàn tất smoke test origin/public, ghi lại build SHA, kết quả nginx validation và quyết định giữ/rollback.



## Giả định đã khóa

- Canonical route tiếp tục là `/bond/` để không đổi URL production hiện tại.
- Chỉ tạo bond mới trên V2; V1 tồn tại để xem và claim lịch sử.
- Giữ cả hai chiều nhập của Buy Bond theo lựa chọn của bạn.
- Bỏ donut/status panels vì dữ liệu đã có trên homepage.
- Không sửa hoặc redeploy smart contract; do đó UI không tuyên bố slippage protection mà contract không thể enforce.

