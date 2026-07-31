# BONDING-UI SECURITY REVIEW

**Ngày review:** 2026-07-30  
**Branch / commit:** `bonding-ui` / `b869b8297839b4570011909405987bcc3a269a23`  
**Tài liệu gốc:** `docs/add-bonding-ui.md`

## 1. Kết luận ngắn

Bonding UI có nền tảng bảo mật tương đối tốt: write target được cố định trong code, approval dùng exact input, mọi write đều simulate trước, confirmation fallback kiểm tra sender/target/full calldata, API có body cap/rate limit/origin check, và lỗi RPC được redact.

Sau khi áp dụng threat model và quyết định thiết kế đã ghi rõ trong
`docs/add-bonding-ui.md`, kết quả được phân loại như sau:

| Mức độ | Số lượng |
| --- | ---: |
| Critical | 0 |
| High | 0 |
| Medium | 2 |
| Low | 3 |
| Accepted design risk / Informational | 2 |

Việc không có `minOut`/deadline và tự fresh-quote trước write là thiết kế có chủ ý:
PRANA chấp nhận residual risk chênh lệch quote/execution vì quy mô và traffic hiện
tại khiến tình huống này hầu như không xảy ra. Báo cáo vẫn mô tả giới hạn kỹ thuật
để threat model không bị hiểu nhầm, nhưng không tính BUI-SEC-01/02 là
vulnerability cần khắc phục trong phạm vi thiết kế hiện tại.

## 2. Phạm vi và phương pháp

Đã review:

- Frontend Bonding: `features/bonding/**`, `pages/BondingPage.tsx`.
- Shared wallet/UI boundary: `features/web3/**`, `components/ui/**`, `utils/fetchJson.ts`.
- Backend Bonding: bốn API config/account/quote/confirm, route admission, rate limit, RPC provider, error redaction và security headers.
- Constants/ABI và các phần của Buy/Sell V1/V2 contract cần thiết để xác minh calldata, quote math, vesting và độ phức tạp của account reads.
- Test hiện có, production build và dependency posture trong repo.

Đây không phải audit đầy đủ toàn bộ smart contract hoặc hạ tầng đang chạy thực tế. Contract được đọc ở mức cần thiết để đánh giá các đảm bảo mà UI/backend đang dựa vào.

## 3. Findings và accepted design risks

### BUI-SEC-01 — Accepted design risk — Không dùng `minOut` hoặc deadline

**Vị trí**

- `contracts/BuyPranaBondV2.sol:185`
- `contracts/SellPranaBondV2.sol:135`
- `features/bonding/hooks/useBondTransaction.ts:663`
- `docs/add-bonding-ui.md:99`

**Quyết định thiết kế**

`buyBondForWbtcAmount(wbtcAmount, period)` không nhận `minPranaOut`; `sellBond(pranaAmount, period)` không nhận `minWbtcOut`. Cả hai cũng không nhận deadline.

Backend trả quote theo snapshot của một block và frontend fresh-quote/simulate trước write, nhưng calldata chỉ khóa input và term. Payout được contract tính lại khi transaction thực thi. Các thay đổi sau simulation — bond khác, thay đổi spot price/liquidity của pool, manager sync/set impacted reserves, hoặc transaction bị pending lâu — có thể làm output thấp hơn số user vừa xem.

Pricing còn đọc spot state của Uniswap V3 thay vì TWAP. Contract luôn chọn nhánh output bất lợi hơn giữa impacted reserve và market reserve. Vì vậy spot manipulation hoặc manager-key compromise có thể làm payout giảm mạnh; không có ngưỡng do user ký để transaction tự revert.

Đây là residual risk đã được chấp nhận rõ trong `docs/add-bonding-ui.md:99-103`,
không phải lỗi implementation: PRANA ưu tiên contract/API tối giản và đánh giá
khả năng state thay đổi giữa quote và execution là không đáng kể ở quy mô hiện tại.

**Giới hạn kỹ thuật cần tiếp tục công bố**

- User luôn chi đúng exact input, nhưng có thể nhận ít PRANA/WBTC hơn đáng kể so với quote.
- Wallet prompt không thể hiển thị hoặc enforce payout vì payout không nằm trong calldata.
- Fresh quote và simulation tạo guard UX, không phải bảo đảm tài chính on-chain.

**Điều kiện cần mở lại quyết định**

- Hiển thị cảnh báo rõ rằng expected output không được bảo đảm.
- Theo dõi thực tế chênh lệch quote/execution, pending time, volume và pool liquidity.
- Re-evaluate `minOut`/deadline nếu volume, concurrency, MEV exposure hoặc giá trị
  trung bình mỗi bond tăng đáng kể; nếu threat model thay đổi, contract mới là nơi
  duy nhất có thể enforce bảo vệ này.

### BUI-SEC-02 — Accepted design risk — Fresh quote thay đổi không yêu cầu consent lần hai

**Vị trí**

- `features/bonding/hooks/useBondTransaction.ts:508`
- `features/bonding/hooks/useBondTransaction.ts:530`
- `features/bonding/hooks/useBondTransaction.ts:591`
- `features/bonding/hooks/useBondTransaction.ts:600`
- `features/bonding/hooks/useBondTransaction.ts:602`

**Quyết định thiết kế**

Flow hiện tại:

1. `openReview()` lấy quote A và mở dialog.
2. User bấm Confirm dựa trên quote A.
3. `runCreate()` lấy quote B.
4. Code gọi `setReviewQuote(B)` rồi tiếp tục simulate/write ngay.

Nếu quote B khác quote A, React state update không tạo một bước consent mới. Wallet mở sau đó chỉ hiển thị input/term, không hiển thị payout.

Behavior này phù hợp với quyết định trong `docs/add-bonding-ui.md:97-109`: khi exact
raw input không đổi, app cập nhật quote/cap rồi tiếp tục flow. Với giả định state
hầu như không đổi ở quy mô hiện tại, PRANA chấp nhận không thêm một bước confirm
thứ hai.

**Giới hạn kỹ thuật cần tiếp tục công bố**

- User xác nhận dialog theo số liệu A nhưng transaction có thể thực thi theo trạng
  thái B; BUI-SEC-01 khiến chênh lệch này không được contract chặn.
- Đây không được tính là vulnerability trong threat model hiện tại, nhưng cần
  re-evaluate cùng BUI-SEC-01 nếu quy mô/traffic thay đổi.

**Hardening không làm thay đổi thiết kế (đã ship)**

- Client validate response echo trước approve/review/create (`features/bonding/utils/bondQuoteEcho.ts`):
  - Buy: `mode`, `termId`, `wbtcAmountRaw === reviewedInputRaw`.
  - Sell: `mode`, `termId`, `pranaAmountRaw === reviewedInputRaw`.
  - Mismatch → dừng flow với `quote_issues` (không mở ví / không broadcast).
- Calldata input luôn lấy từ form/review snapshot (`resolveCreateAmountRaw`), không lấy
  input leg từ quote response.
- Có thể thêm telemetry cho chênh lệch quote A/B; chỉ yêu cầu confirm lần hai nếu
  sau này protocol đặt threshold thay đổi tối đa.

### BUI-SEC-03 — Medium — Account API là RPC amplification point với scan không giới hạn theo tổng số bond

**Vị trí**

- `server/loaders/bondingAccount.ts:50`
- `server/loaders/bondingAccount.ts:55`
- `server/loaders/bondingAccount.ts:58`
- `contracts/BuyPranaBondV1.sol:382`
- `contracts/BuyPranaBondV2.sol:373`
- `contracts/SellPranaBondV1.sol:315`
- `contracts/SellPranaBondV2.sol:318`

**Mô tả**

Mỗi `GET /api/bonding/account?address=...` chạy balance/allowance reads và đồng thời gọi `getUserActiveBonds` trên cả bốn deployment.

Mỗi `getUserActiveBonds` scan toàn bộ `bonds` array hai lần: một lần đếm, một lần copy. Chi phí vì vậy tăng theo tổng số bond toàn contract, kể cả khi address được hỏi không có bond. Endpoint công khai chấp nhận bất kỳ address hợp lệ nào và không cache/dedupe theo address.

Rate limit 10/IP và 120 global/phút giúp giảm tải, nhưng 120 request có thể tương ứng 480 full-array contract scans; request RPC treo cũng không có deadline riêng ở loader.

**Ảnh hưởng**

- RPC/server latency và chi phí tăng dần theo lịch sử protocol.
- Attacker phân tán có thể dùng address hợp lệ để làm cạn RPC capacity.
- Một read lỗi làm toàn bộ account snapshot trả `502`, khiến balance, allowance và claim UI cùng mất.

**Khuyến nghị**

- Không dùng `getUserActiveBonds` làm read path dài hạn.
- Index `BondCreated`/`BondClaimed` events vào store server-side, rồi reconcile bond cần thiết bằng direct `bonds(id)` reads.
- Thêm per-address short cache, in-flight dedupe, concurrency cap và RPC timeout/abort.
- Tách dữ liệu balances/allowances khỏi active-bond history để lỗi history không làm mất toàn bộ form.
- Theo dõi latency/timeout theo từng deployment và đặt circuit breaker.

### BUI-SEC-04 — Medium — Tracked TLS edge config chưa bật HSTS

**Vị trí**

- `docs/vps-prana.triethocduongpho.net:16`
- `server/securityHeaders.ts:32`

**Mô tả**

Config trong repo redirect HTTP sang HTTPS nhưng không đặt `Strict-Transport-Security`. Node có CSP, frame protection, `nosniff` và referrer policy, nhưng cũng không đặt HSTS.

Trong lần truy cập HTTP đầu tiên, network attacker có thể chặn trước redirect và đưa user tới một bonding UI giả. Với dApp có wallet approval/create flows, first-visit downgrade/phishing có tác động trực tiếp tới tài sản.

**Khuyến nghị**

Đặt HSTS tại TLS-terminating VPS nginx, sau khi xác nhận toàn bộ host luôn hỗ trợ HTTPS:

```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
```

Chỉ thêm `includeSubDomains`/`preload` sau khi audit toàn bộ subdomain và hoàn tất preload requirements. Kiểm tra header trên response 200, redirect và error. (future work)

**Trạng thái (tracked config):** `docs/vps-prana.triethocduongpho.net` đã thêm HSTS host-scoped (`max-age=31536000` + `always`), kể cả lặp lại dưới `/bond/assets/`. Vẫn cần deploy lên VPS nginx thực tế rồi verify bằng `curl -I`.

### BUI-SEC-05 — Low — Pending transaction chỉ tồn tại trong React memory và không bind account/chain

**Trạng thái:** Mitigated (2026-07-31)

**Vị trí**

- `features/bonding/utils/bondPendingTransactionStorage.ts`
- `features/bonding/hooks/usePendingBondTransaction.ts`
- `features/bonding/hooks/useBondTransaction.ts`
- `features/bonding/hooks/useBondActions.ts`
- `features/bonding/utils/bondTransactionConfirmation.ts`

**Mô tả (ban đầu)**

Pending state chỉ lưu `{hash, action}` bằng `useState`. Reload/tab crash làm mất state; account/chain không được lưu cùng pending record. Khi browser RPC trả receipt success, client không gọi server validator để đối chiếu sender/target/calldata.

**Cách khắc phục**

- Persist `{version, chainId, account, hash, action, createdAt}` vào `localStorage` với TTL 24h, key bind theo account/chain.
- Form (`approve`/`create`) và claim mỗi bên restore đúng action kind khi mount/reconnect; write bị khóa cho đến khi storage đã load và không còn pending của chính flow đó.
- Pending record luôn dùng account lúc broadcast; đổi wallet giữa chừng không báo success cho ví mới (storage của ví cũ vẫn giữ để resume khi quay lại).
- Resume / reload bắt buộc `requireServerValidation`: browser receipt success vẫn phải qua server sender/target/full calldata trước khi UI báo confirmed.

### BUI-SEC-06 — Low — Invalid requests tiêu hao global rate-limit quota trước admission

**Vị trí**

- `server/postApiRoutes.ts` (bonding quote + confirm-transaction)

**Mô tả**

Quote và confirmation rate limit từng chạy trước Content-Type/origin validation và trước body parsing/shape validation. Vì vậy request sai media type, forbidden origin, JSON lỗi hoặc action sai vẫn làm tăng per-IP/global counters.

Global quote quota chỉ 60/phút và confirmation quota 120/phút. Một nhóm nhỏ IP có thể làm cạn quota mà không cần tạo request hợp lệ hay gọi RPC.

**Ảnh hưởng**

User hợp lệ có thể bị `429` dù attacker chỉ gửi junk; không phải RCE/write tùy ý.

**Mitigation (shipped)**

- Reorder bonding POST quote/confirm: Content-Type/origin → body/shape parse → rồi mới `isBonding*RateLimited` trước RPC.
- Flood volume vẫn dựa vào VPS nginx edge (không thêm Node admission bucket riêng).
- Tests: malformed/forbidden requests không làm giảm global bonding quote/confirmation budget (`bondingApi.test.ts`).

**Khuyến nghị gốc (đã áp dụng tối giản)**

1. Cheap edge limiter trước khi đọc body → VPS nginx hiện có.
2. Sau Content-Type/origin/body/shape validation, mới consume quota dành cho expensive RPC/global capacity.

### BUI-SEC-07 — Low — Decimal raw input không bị giới hạn trong miền `uint256`

**Trạng thái:** Mitigated (2026-07-31)

**Vị trí**

- `server/utils/parseUnsignedDecimalRaw.ts`
- `server/utils/bondingReadUtils.ts` (quote / approve / create / claim parse)

**Mô tả (ban đầu)**

`parseUnsignedDecimalRaw` nhận mọi chuỗi digit không âm nhưng không giới hạn `<= 2^256 - 1`, không giới hạn số digit độc lập với body cap, và chấp nhận zero cho create/claim.

Quote với amount ngoài `uint256` vẫn thực hiện RPC/math trước khi kết quả trở nên vô nghĩa. Confirmation có thể đi tới ABI encoder rồi ném lỗi range; route phân loại lỗi này thành `502 upstream_unavailable` thay vì `400 invalid_request`.

**Cách khắc phục**

- Parser chung yêu cầu canonical decimal (`0` hoặc `[1-9]\d*`), `value <= MAX_UINT256`, và reject chuỗi dài hơn 78 digit trước BigInt.
- Quote amount, create amount, claim bond ID: require `> 0`. Approve zero vẫn được hỗ trợ (ERC-20 revoke).
- Reject ở parse (trước RPC/ABI encode) → route map `BondingApiValidationError` thành `400 invalid_request`.
- Boundary tests: `MAX_UINT256`, `MAX_UINT256 + 1`, zero, leading zeros, và chuỗi digit sát body cap (`bondingApi.test.ts`).

## 4. Observations / hardening

### ~~OBS-01 — POST cache policy lệch tài liệu~~ (mitigated)

`POST /api/bonding/quote` và `POST /api/bonding/confirm-transaction` giờ trả `Cache-Control: private, no-store` (cùng constant pattern với staking quote), khớp `docs/add-bonding-ui.md` / `docs/CACHE_ARCHITECTURE.md`. Route tests assert header trên success path.

### OBS-02 — Dependency audit chưa có baseline sạch, tái lập được

- Báo cáo gần nhất trong repo (`docs/npm-audit-report.md`, 2026-07-18) ghi 44 advisories: 20 low, 13 moderate, 11 high, 0 critical; tài liệu đánh giá phần lớn là transitive tooling/contract packages.
- Installed tree hiện có `axios@1.18.1` và `ws@8.21.1`, nhưng `npm ls axios ws --all` trả `ELSPROBLEMS` vì `ws@8.21.1` bị đánh dấu không thỏa exact ranges `8.21.0`/`8.18.0` của một số consumer.
- Live `npm audit --json` không hoàn tất trong môi trường review do không truy cập được npm registry, nên báo cáo này không khẳng định advisory count ngày 2026-07-30.

Nên làm sạch override/lockfile để `npm ci` và `npm ls` pass trong CI, rồi chạy `npm audit --omit=dev` định kỳ và phân loại theo production reachability.

## 5. Controls đã kiểm tra và đánh giá tốt

- Frontend không nhận contract address từ API cho write; create/claim target dùng internal mapping.
- Confirmation fallback kiểm tra sender, fixed target và full calldata trước khi tin receipt.
- Exact WBTC Buy / exact PRANA Sell dùng exact approval amount; allowance lớn hơn không bị hạ.
- Write flow simulate trước broadcast và không retry write sau khi đã có hash trong cùng component lifetime.
- Account write gates không fallback sang failed cached refetch.
- Quote/account reads dùng cùng `blockTag`; bigint được serialize bằng decimal string.
- API có method checks, JSON Content-Type validation, 2 KB body cap, checksum address, origin check, per-IP/global limit và generic `502`.
- RPC URL/API key được redact khỏi server response/log test cases.
- React render không thấy `dangerouslySetInnerHTML` trong Bonding UI; dynamic values được React escape.
- CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff` và safe external-link `rel` đang được áp dụng.

## 6. Verification đã chạy

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run test:bonding` | 69/69 pass |
| Targeted Bonding API/routes/rate/security tests | 56/56 pass |
| `npm test` | 154 server + 38 client tests pass |
| `npm run test:staking` | 35/35 pass |
| `npm run build` | Pass, tạo lazy `BondingEntry` chunk |
| `npm ls axios ws --all` | Fail `ELSPROBLEMS` do `ws` override/range mismatch |
| `npm audit --json` | Không hoàn tất: npm registry không truy cập được trong môi trường review |

Các test pass xác nhận behavior hiện tại, nhưng chưa có test cho:

- Fresh-quote response bị reject nếu `mode`, `termId` hoặc exact input không khớp
  review snapshot.
- ~~Pending hash sống qua reload và bind đúng account/chain.~~ (covered by `bondPendingTransactionStorage` + confirmation resume tests)
- ~~Malformed requests không tiêu global expensive-RPC quota.~~ (BUI-SEC-06: validate-before-rate-limit on bonding POST)
- Raw amount vượt `uint256`.
- Account endpoint dưới tải khi tổng bond history tăng lớn.

## 7. Thứ tự khắc phục đề xuất

1. Thay full-array account scans bằng event indexer và thêm timeout/concurrency protection.
2. Bật HSTS tại TLS edge.
3. ~~Persist và bind pending transaction với account/chain.~~ (BUI-SEC-05 mitigated)
4. ~~Tách admission/global RPC quota~~ (BUI-SEC-06: validate trước rate-limit; edge nginx giữ flood), thêm `uint256` bounds; ~~quote/confirm `private, no-store`~~ (OBS-01).
5. Làm sạch dependency override/lockfile và thiết lập audit CI có baseline.
6. Theo dõi quote/execution delta, volume, liquidity và pending time; chỉ mở lại
   quyết định `minOut`/deadline/second consent khi các giả định quy mô không còn đúng.
