# Tổng quan bảo mật — Node App, Swap, Staking & Bonding

Tài liệu này mô tả các cơ chế liên quan đến bảo mật hiện đang được triển khai trong Node app và các feature Swap, Staking, Bonding trên Polygon. Đây là bản liệt kê thực tế về cách hệ thống hoạt động hiện nay, dựa trên codebase.

Đây không phải audit đầy đủ smart-contract, dependency, wallet-extension, hay hạ tầng production. Guard frontend và preflight backend cải thiện an toàn và UX, nhưng contract đã deploy và giao dịch cuối cùng user duyệt trong ví vẫn là nguồn quyền lực.

Đường dẫn mạng production (VPS, reverse SSH tunnel, Pi nginx, TLS/rate limit ở edge) được ghi trong [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md).

Tài liệu liên quan:

- [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md) — reverse tunnel VPS ↔ Pi và nginx ở edge
- [`swap-modal-technical-overview.md`](./swap-modal-technical-overview.md) — swap feature end-to-end
- [`staking-technical-overview.md`](./staking-technical-overview.md) — staking feature end-to-end
- [`bonding-technical-overview.md`](./bonding-technical-overview.md) — bonding feature end-to-end
- Bản tiếng Anh: [`SECURITY_OVERVIEW.md`](../SECURITY_OVERVIEW.md)

---

## 1. HTTP security headers trên Node

Áp dụng cho response API và static qua `setSecurityHeaders()` (`server/securityHeaders.ts`), được gọi từ `requestHelpers.ts` và `serveFile.ts`.

| Header | Hành vi |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; `base-uri 'self'`; `object-src 'none'`; `frame-ancestors 'none'`; script từ `'self'` cộng host Google model-viewer/Draco với `'wasm-unsafe-eval'`; `style-src 'self' 'unsafe-inline'`; `img-src` / `font-src` `'self' data:`; `connect-src` same-origin + `blob:` + frontend Polygon RPC (`https://polygon.drpc.org`) + host model-viewer; `worker-src 'self' blob:`; `form-action 'self'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

HSTS **không** do Node đặt. TLS edge (`docs/vps-prana.triethocduongpho.net`) gửi `Strict-Transport-Security: max-age=31536000` cho `prana.triethocduongpho.net`, bao gồm homepage (swap), `/stake/`, `/bond/` và API. Xem [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md).

---

## 2. Swap modal — mô hình bảo mật

### 2.1 Ràng buộc phạm vi (V1)

- **Chain:** chỉ Polygon mainnet (`chainId` `137`).
- **Token:** allowlist cố định gồm bảy symbol (`PRANA`, `WBTC`, `POL`, `USDC`, `USDT`, `WETH`, `DAI`) qua `V1_SWAP_TOKENS` / `getSwapToken()`.
- **Router:** Uniswap SwapRouter02 trên Polygon ([`0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`](https://polygonscan.com/address/0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45#tokentxns)).
- **Slippage UI:** cố định `50` bps (0.5%) trong modal; server giới hạn bps được gửi trong khoảng `[1, 500]` qua `getValidatedSlippageBps()`.
- **Wallet:** chỉ injected connector (wagmi); không dùng WalletConnect / LiFi / 0x / RainbowKit.
- **Nguồn calldata:** browser không tự dựng swap calldata; nó gửi đúng `quote.transaction.{to, data, value}` từ response của server.

### 2.2 Tách RPC

| Bên dùng | RPC | Vị trí cấu hình |
| --- | --- | --- |
| Browser (số dư, allowance, send/wait) | Public `https://polygon.drpc.org` | `constants/network.ts` → wagmi/viem |
| Server (AlphaRouter, QuoterV2, verify) | `VITE_ALCHEMY_POLYGON_MAIN` hoặc `POLYGON_RPC_URL`, nếu không thì `polygon-rpc.com` | `server/utils/providers.ts` |

Key Alchemy (hoặc RPC private khác) chỉ nằm trên process server. CSP `connect-src` cho phép host RPC public của frontend để browser gọi.

### 2.3 Bề mặt API Swap

Mọi endpoint swap đều chỉ nhận POST, body JSON, kiểm tra same-origin, giới hạn kích thước body, và rate limit theo IP (`server/postApiRoutes.ts`, `server/rateLimit.ts`, `server/helpers/apiRoutesHelpers.ts`, `server/helpers/postApiRoutesHelpers.ts`).

| Endpoint | Mục đích | Giới hạn body | Rate limit |
| --- | --- | --- | --- |
| `POST /api/swap/quote` | Route + unsigned tx + HMAC | 2 KB | 5 / IP / phút + 30 global / phút |
| `POST /api/swap/log` | Telemetry vòng đời (không tin cậy) | 8 KB | 30 / IP / phút |
| `POST /api/swap/verify-transaction` | Chứng minh on-chain → log `swap_confirmed` đã verify | 32 KB | 10 / IP / phút |

Rate limiter dùng cửa sổ thời gian cố định trong bộ nhớ process, kèm dọn bucket định kỳ.

IP client cho rate limiting (`server/helpers/rateLimitHelpers.ts`): chỉ tin `X-Forwarded-For` khi peer socket trực tiếp là proxy localhost (`127.0.0.1` / `::1`). Khi đó IP client được lấy bằng cách đếm hop từ bên phải của header (`TRUSTED_PROXY_HOP_COUNT`; production dùng `2` vì cả VPS lẫn Pi nginx đều append — xem [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md)). Nếu không, dùng địa chỉ socket.

### 2.4 Kiểm tra admission chung cho POST

Các route POST của Swap, Staking và Bonding tái dùng `rejectInvalidWeb3PostRequest()`:

1. Yêu cầu `Content-Type` khớp JSON (`application/json` hoặc `*+json`).
2. Nếu có header `Origin`, yêu cầu nó khớp với các ứng viên `Host` / `X-Forwarded-Host` của request (có ngoại lệ localhost-to-localhost cho local dev). Thiếu `Origin` thì được phép (client không phải browser). Không khớp → `403 forbidden_origin`.

`readJsonBody()` áp dụng giới hạn byte theo từng route và từ chối body rỗng.

Kiểm tra same-origin là admission request của browser, không phải authentication hay authorization. Mọi dữ liệu theo ví đến từ state on-chain công khai, và chữ ký ví của user vẫn là authorization cho các write.

Thứ tự admission cho Web3 POST:

1. Admission per-IP rẻ dùng chung (`isWeb3PostAdmissionRateLimited`, 300 / IP / phút) — bảo vệ Node khỏi flood parse; không có bucket global.
2. Kiểm tra Content-Type / origin.
3. Đọc body JSON có giới hạn byte + parse hình dạng theo từng feature.
4. Budget RPC/log khan hiếm theo feature (quote/confirm/verify/log).
5. Việc đắt (RPC, verify HMAC, ghi log).

Route quote và confirmation của Swap, Staking và Bonding chỉ tiêu budget RPC đắt sau khi body đã có hình dạng hợp lệ. GET account của Bonding và Staking vẫn validate địa chỉ trước khi tiêu budget đọc account.

`POST /api/swap/log` và `POST /api/swap/verify-transaction` cũng chạy shared admission trước; bucket feature của chúng vẫn là giới hạn ingestion/verify theo IP (verify chưa có quota RPC global trong pass này).

Traffic malformed cũng bị giới hạn ở edge VPS nginx; budget trong process Node không thay thế kiểm soát flood ở edge.

### 2.5 Pipeline quote (`server/loaders/swapQuote.ts`)

1. Resolve token từ allowlist; từ chối cặp cùng token, recipient không hợp lệ, số lượng không dương.
2. Route chính: Uniswap AlphaRouter (`SwapType.SWAP_ROUTER_02`) qua Polygon RPC của server.
3. Fallback (cặp PRANA khi AlphaRouter không có route dùng được): ghép qua pool V3 WBTC/PRANA đã biết; bọc trong `multicall(deadline, …)`; có thể kèm `unwrapWETH9` khi nhận native POL.
4. Gọi `validateSwapTransaction()` trước khi trả về.
5. Gọi `attachSwapQuoteVerification()` (HMAC).
6. Ghi structured log phía server cho route được chọn và các lần thất bại.

### 2.6 Kiểm tra calldata (`server/loaders/swapValidations.ts`)

Trước khi trả quote cho client, server decode calldata SwapRouter02 (kể cả `multicall` lồng nhau) và kiểm tra:

- `transaction.to` là SwapRouter02
- Native `value` bằng `amountIn` khi input là native POL, nếu không thì `0`
- Recipient là ví user, chính router, hoặc địa chỉ sentinel của SwapRouter02 (`msg.sender` / `address(this)`)
- Input và min-out khi áp dụng; ngân sách input tích lũy qua các leg
- Endpoint của V3 path (chế độ strict cho quote fallback)
- Deadline của multicall khớp deadline của quote; độ sâu lồng nhau ≤ 4
- Chỉ các method router trong allowlist: `exactInput`, `exactInputSingle`, `swapExactTokensForTokens`, `wrapETH`, `unwrapWETH9`, `sweepToken`, `refundETH`, và `multicall`

Calldata không hỗ trợ hoặc không mong đợi làm quote thất bại. Lỗi trả về client được sanitize (xem bên dưới).

### 2.7 HMAC quote và chống replay (`server/loaders/swapQuoteVerification.ts`)

- Sau khi quote thành công, server gắn `verification` với `version` (hiện tại `2`), `issuedAt`, `expiresAt` (TTL 5 phút), và `token` HMAC-SHA256.
- Payload được ký gồm các trường quote đã chuẩn hóa: metadata request, token/số lượng, route, router, transaction `{to, data, value}`, deadline. Address/calldata được đưa về chữ thường; key object được stable-stringify.
- Signing secret là giá trị `randomBytes(32)` **local theo process** (tạo lại khi restart).
- Verify dùng `timingSafeEqual` trên digest đã decode hex.
- Map replay trong bộ nhớ lưu `sha256(token)` → thời điểm hết hạn; `assertSwapQuoteTokenUnused` chạy trước RPC; `markSwapQuoteTokenUsed` chỉ chạy sau khi verify on-chain thành công và ghi log đã verify.

### 2.8 Verify on-chain (`server/loaders/swapTransactionVerification.ts`)

Dùng khi client báo một swap đã confirmed. Luồng:

1. Parse body: địa chỉ owner, tx hash 32 byte, object quote đầy đủ.
2. `verifySwapQuoteToken` (HMAC + hết hạn).
3. Kiểm tra hình dạng: chainId Polygon, recipient khớp owner, router/`to` là SwapRouter02.
4. Chống replay (token chưa dùng).
5. Tải tx + receipt từ Polygon RPC của server.
6. Khẳng định receipt thành công, sender = owner, `to` = router, calldata và value khớp quote đã ký.
7. Ghi log `swap_confirmed` đã verify; đánh dấu token đã dùng.

Client không thể tạo log confirmation đã verify nếu không có giao dịch on-chain khớp với quote do server ký.

### 2.9 Logging so với telemetry

- `/api/swap/log` nhận event từ browser: `approval_*`, `swap_submitted`, `swap_failed` (và các event liên quan). Được coi là telemetry không tin cậy.
- Swap confirmed từ browser được client (`features/swap/utils/swapTransactionLogs.ts`) chuyển sang `/api/swap/verify-transaction` thay vì endpoint log thường.
- Log server (`server/loaders/swapLogs.ts`) che URL `http(s)://` và đoạn giống Alchemy key; cắt ngắn trường chuỗi; gắn metadata request đã sanitize (IP, host, origin, user-agent).

### 2.10 Sanitize lỗi (`sanitizeSwapErrorMessage`)

Chỉ một allowlist cố định các thông báo validation được trả về client. Các lỗi khác (kể cả nội bộ RPC/Uniswap) trở thành chuỗi fallback chung. Syntax error map sang “Invalid JSON request body.”

---

## 3. Guard phía frontend cho swap

Chủ yếu nằm trong `features/swap/hooks/useUniswapQuote.ts` và `features/swap/hooks/useUniswapSwap.ts`.

| Cơ chế | Hành vi |
| --- | --- |
| Debounce quote | 1000 ms sau khi input ổn định; xóa quote cũ ngay khi input đổi |
| Deadline quote | `SWAP_DEADLINE_SECONDS` = 3 phút deadline on-chain trong router calldata |
| Buffer hết hạn | Chặn swap nếu deadline còn trong vòng 5 giây |
| Echo request | Response quote gồm metadata request; frontend yêu cầu khớp chainId, token, `amountInRaw`, recipient, slippage, router/`to` trước khi approve/swap |
| Cooldown refresh thủ công | 60 giây |
| Cổng mạng | `ensurePolygon()` chuyển injected wallet sang chain `137` khi cần |
| Approval | Approve đúng `amountInRaw` cho SwapRouter02 khi allowance chưa đủ (không unlimited); native POL bỏ qua approve |
| Execution | `walletClient.sendTransaction` với `to` / `data` / `value` do server cung cấp; receipt reverted được coi là thất bại |

Kết nối ví dùng injected connector đầu tiên có sẵn (`features/web3/useInjectedWallet`).

---

## 4. Staking — mô hình bảo mật

### 4.1 Phạm vi và ranh giới tin cậy

- **Chain:** chỉ Polygon mainnet (`chainId` `137`).
- **Wallet:** injected connector; ví user ký dữ liệu EIP-712 permit và broadcast mọi write.
- **Write target:** `stakeWithPermit`, `claimInterest`, `unstake`, và `unstakeEarly` luôn nhắm tới `STAKING_CONTRACT_ADDRESS` hardcoded trên browser.
- **Phạm vi permit:** domain/name/version EIP-2612 của token và spender được ghim trong browser bằng constant local (và assert với `/api/staking/config` trước khi ký); permit có deadline một giờ.
- **Vai trò backend:** config, account, quote và confirmation fallback là dịch vụ đọc/verify. Backend không giữ key user, không ký permit, không broadcast transaction.

Server dựng permit config từ các constant PRANA và Staking hardcoded của chính nó. Trước khi ký, browser assert các giá trị trả về với cùng constant local (`PRANA_ADDRESS`, `STAKING_CONTRACT_ADDRESS`, permit domain name/version) và dựng EIP-712 typed data từ các pin local — không từ API response. Config lệch thì fail closed, không mở ví, nên response bị compromise không thể đổi verifying contract hay spender của permit.

### 4.2 Bề mặt API Staking

| Endpoint | Hành vi liên quan bảo mật |
| --- | --- |
| `GET /api/staking/config` | `private, max-age=30`; không rate limit route Node; cache pause/minimum/grace/penalty/APR và dữ liệu permit-domain |
| `GET /api/staking/account?address=` | Validate checksum address; `private, no-store`; 10 / IP / phút + 120 global / phút; snapshot balance/nonce/stakes cùng một block |
| `POST /api/staking/quote` | JSON, giới hạn 2 KB, `private, no-store`; 10 / IP / phút + 60 global / phút; validate body trước khi tiêu budget RPC |
| `POST /api/staking/confirm-transaction` | JSON, giới hạn 2 KB, `private, no-store`; bucket confirmation riêng 30 / IP / phút + 120 global / phút; validate body trước khi tiêu budget RPC |
| `GET /api/staking-stats` | Aggregate homepage cache 24 giờ; không bao giờ dùng để authorize hay fund-gate một stake |

Số lượng raw chuẩn và permit nonce là decimal string, không phải JavaScript number. Parser server giới hạn số nguyên raw trong `uint256`; stake ID của action giới hạn trong `uint32` của contract.

### 4.3 Guard permit-and-stake

Trước khi yêu cầu chữ ký permit, client assert các field permit từ API khớp pin local, refetch account/nonce ví hiện tại, và xin quote mới. Trước khi broadcast `stakeWithPermit`, nó xin thêm một quote mới. Ví, chain, balance, minimum, duration, trạng thái pause và các issue của quote vẫn phải hợp lệ. User vẫn nên tự kiểm tra token và spender của permit trong ví; app đã ghim các field typed-data đó vào constant local.

Staking dùng EIP-2612 permit đúng số lượng, không dùng transaction ERC-20 `approve`. Permit bị invalidate trong client state khi nonce, amount, duration, account, chain hoặc deadline không còn khớp.

Quote đọc pause, minimum, APR, số dư PRANA của Interest contract, và `totalInterestNeeded` tại một `blockTag`. Nó tính:

```text
availableInterest = max(interestBalance - totalInterestNeeded, 0)
```

CTA bị chặn khi lãi tính cho stake mới không vừa. Đây là **soft preflight**, không phải reservation on-chain: transaction hoặc state khác có thể làm mất hiệu lực trước khi thực thi, và contract vẫn có thể revert.

Nếu ký permit thành công nhưng broadcast không ra được transaction hash, client có thể giữ permit trong memory cho **Continue Stake** cho đến khi amount, duration, ví, chain, ngữ cảnh nonce hoặc deadline trở nên không hợp lệ. Thành phần chữ ký permit gửi lên confirmation endpoint chỉ dùng để dựng lại và so sánh calldata đã broadcast; không được coi là credential.

### 4.4 Action Staking và confirmation

- Target claim/unstake/early-unstake cố định trong code. UI suy ra action khả dụng từ timestamp on-chain và config, gồm claim-before-unstake trong cửa sổ grace và cảnh báo penalty early-unstake tường minh.
- Các rule action này là guard UX; execution của contract là nguồn quyền lực. Interest chưa claim sau grace có thể mất theo semantics contract hiện tại.
- Khi đã có hash, app lưu `{chainId, account, hash, action, createdAt}` trong `localStorage` tối đa 24 giờ và không bao giờ rebroadcast action đó khi resume.
- Transaction mới trong session có thể được chấp nhận từ receipt của browser/wallet RPC. Resume/reload đòi hỏi server validate trạng thái receipt, sender, target hardcoded, và full calldata đã dựng lại.
- RPC lookup thất bại là `confirmation_unavailable`, không phải revert. Chỉ receipt reverted tường minh mới báo là reverted.
- Confirmation endpoint là đường recovery UX. Nó không dùng HMAC/replay của Swap quote và không tạo analytics tin cậy.

### 4.5 Giới hạn Staking và xử lý lỗi

- Frontend Staking **không** gọi tường minh `simulateContract` trước các write stake/claim/unstake. Ước lượng gas của wallet/client và revert của contract vẫn là safeguard trước khi thực thi.
- Cache config 30 giây có thể lệch tạm thời khi pause, term hoặc penalty đổi. Quote mới giảm rủi ro này cho eligibility stake, nhưng contract vẫn là nguồn quyền lực.
- Nếu đồng bộ account sau receipt thất bại cho một stake action, UI có thể khóa write action tiếp theo đến khi reload thay vì rủi ro hành động trên account state cũ.
- Lỗi validation server dùng allowlist; RPC/internal bất ngờ trả `502` chung. Lỗi wallet/provider phía client được map sang thông báo localized ổn định; chi tiết thô không đưa vào copy cho user.

---

## 5. Bonding — mô hình bảo mật

### 5.1 Phạm vi và ranh giới tin cậy

- **Chain:** chỉ Polygon mainnet (`chainId` `137`).
- **Chế độ create:** exact WBTC → PRANA Buy Bond, hoặc exact PRANA → WBTC Sell Bond.
- **Deployment:** bond mới chỉ tạo trên V2. Claim hỗ trợ Buy/Sell × V1/V2 qua mapping side/version nội bộ.
- **Wallet:** injected connector broadcast transaction ERC-20 approval, create và claim.
- **Write target:** địa chỉ token, spender, create-contract và claim-contract đến từ constant hardcoded, không bao giờ từ địa chỉ trong API response.

Backend cung cấp snapshot đọc và expected output. Nó không thể chuyển quỹ, và không dựng payload target/calldata tùy ý để browser thực thi.

### 5.2 Bề mặt API Bonding

| Endpoint | Hành vi liên quan bảo mật |
| --- | --- |
| `GET /api/bonding/config` | `private, max-age=30`; không rate limit route Node; cache trạng thái pause V1/V2 cùng snapshot terms/minimum/address V2 |
| `GET /api/bonding/account?address=` | Validate checksum address; `private, no-store`; 10 / IP / phút + 120 global / phút; balance, allowance V2, và active bonds V1/V2 |
| `POST /api/bonding/quote` | JSON, giới hạn 2 KB, `private, no-store`; 10 / IP / phút + 60 global / phút; validate body trước khi tiêu budget RPC |
| `POST /api/bonding/confirm-transaction` | JSON, giới hạn 2 KB, `private, no-store`; bucket riêng 30 / IP / phút + 120 global / phút; validate body trước khi tiêu budget RPC |

Giá trị raw của quote/create/claim phải là decimal string `uint256` dương chuẩn. Approval cũng chấp nhận zero để revoke allowance.

### 5.3 Guard quote và write

Mỗi quote đọc pause, term/rate, impacted reserve, committed payout, số dư treasury và state pool Uniswap V3 tại một `blockTag`. Math bigint bám thứ tự operation/làm tròn của Solidity và phí 1%. Payout được quote dùng nhánh kém thuận lợi hơn giữa impacted reserve và market reserve, rồi xác nhận quỹ treasury chưa commit đủ cover payout.

Trước approval hoặc create, client refetch thành công config/account và lấy quote mới không có issue chặn. Nó kiểm tra echo response với mode, term và exact input của form. Create calldata dùng input từ form snapshot, không copy amount từ quote response.

- Approval đúng exact input khi allowance hiện tại chưa đủ; allowance lớn hơn sẵn có thì không bị hạ xuống.
- Chỉ **create** được simulate tường minh (`simulateContract`) trước broadcast. Approve và claim dựa vào ước lượng gas của wallet/client và revert của contract, giống claim/unstake của Staking.
- Approve và create cần click riêng của user, không bao giờ tự chain liên tiếp.
- Write của form và write của claim khóa lẫn nhau khi đang có transaction in-flight.

### 5.4 Confirmation và pending transaction

Hash Bonding pending dùng cùng chính sách lưu 24 giờ theo account/chain và không rebroadcast như Staking. Resume/reload đòi hỏi server validate sender, target cố định, và full calldata dựng lại từ action snapshot:

- approval → token WBTC/PRANA cố định + spender V2 cố định + exact amount;
- create → hàm Buy/Sell V2 cố định + exact input + term;
- claim → contract Buy/Sell V1/V2 cố định + bond ID.

Receipt browser mới trong session có thể tin mà không cần validate server. Confirmation endpoint chỉ là fallback UX; không tái dùng HMAC/replay của Swap hay ghi analytics tin cậy.

### 5.5 Rủi ro payout đã chấp nhận: không có `minOut` hay deadline

Hàm create Buy/Sell đã deploy nhận exact input và term nhưng không có minimum payout hay deadline do user ký. Contract tính lại payout lúc thực thi từ state hiện tại. Vì vậy:

- user luôn chi exact input đã approve, nhưng có thể nhận ít PRANA/WBTC hơn quote UI;
- quote mới, validate response-echo và simulation ở create path giảm lỗi state cũ nhưng **không** cung cấp bảo đảm payout on-chain;
- wallet prompt không thể hiện hay enforce payout kỳ vọng vì nó không nằm trong calldata;
- pricing dùng state pool Uniswap V3 hiện tại chứ không phải TWAP, và thay đổi impacted-reserve do manager hoặc transaction cũng có thể đẩy kết quả.

Đây là trade-off thiết kế hiện tại tường minh, không phải bảo vệ do UI cung cấp. Nên đánh giá lại contract mới có `minOut`/deadline nếu volume, concurrency, phơi nhiễm MEV, giá trị bond trung bình, hoặc chênh lệch quote-to-execution quan sát được tăng đáng kể.

Sau khi user bấm **Create Bond**, client fresh-quote rồi tiến tới ví mà không có bước xác nhận in-app thứ hai khi expected payout đổi. Vì payout không có trong calldata, ví vẫn không thể enforce giá trị đã hiển thị.

### 5.6 Giới hạn availability khi đọc account Bonding

`GET /api/bonding/account` gọi `getUserActiveBonds(address)` trên cả bốn deployment Buy/Sell V1/V2. Mỗi implementation contract quét toàn bộ mảng bond hai lần, nên chi phí request tăng theo toàn bộ lịch sử bond của protocol dù địa chỉ được hỏi không có bond.

Bất kỳ một lần đọc nào thất bại đều làm toàn bộ snapshot account — balance, allowance và bonds — trả `502`, và loader không có timeout/abort RPC theo request. Limit per-IP/global giảm tải nhưng không xóa rủi ro khuếch đại RPC này. Thiết kế dài hạn nên index bond event và query theo user thay vì dựa vào bốn lần scan full-history không bị giới hạn.

### 5.7 Xử lý lỗi Bonding

Lỗi body/shape và confirmation-mismatch đã biết trả về `400` đã sanitize. RPC/internal bất ngờ trở thành `502` chung. Lỗi wallet/provider phía client được map sang thông báo localized ổn định; text RPC thô không hiện cho user.

---

## 6. Bảo đảm confirmation chung Staking/Bonding

Helper confirmation server (`server/utils/transactionConfirmationLookup.ts`) chỉ xử lý hash đã broadcast. Nó fetch cả transaction và receipt, rồi:

1. trả `not_mined` nếu thiếu một trong hai;
2. so sánh sender của transaction, target cố định kỳ vọng, và exact calldata;
3. trả `confirmed` chỉ khi receipt status `1`;
4. trả `reverted` chỉ khi receipt status `0`;
5. trả `confirmation_unavailable` khi provider/đọc thất bại hoặc status không biết.

Đây cố ý hẹp hơn verify của Swap: không gắn quote do server phát hành, không enforce payout, không chống replay quote, và không tạo analytics tin cậy. Storage pending-transaction local chỉ là gợi ý resume, không bao giờ là bằng chứng thành công.

---

## 7. Định danh build / deploy (quan sát vận hành)

Không phải cơ chế access-control, nhưng hữu ích để biết binary nào đang chạy:

- Footer / `GET /api/version` lộ git tag và/hoặc short commit (và dấu `*` dirty khi checkout bị dirty lúc resolve identity).
- Identity UI được bake lúc `vite build`; `/api/version` được resolve khi Node process khởi động.

Được ghi trong [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md) §7.

---

## 8. State local theo process (ghi chú vận hành)

Các store trạng thái bảo mật sống trong bộ nhớ của một Node process và không chia sẻ giữa workers hay sau restart:

- Bucket admission Web3 POST dùng chung (per-IP)
- Bucket rate-limit feature per-IP/global của Swap, Staking và Bonding
- HMAC signing secret của Swap
- Cache replay token quote của Swap

Deploy nhiều instance sẽ cần storage rate-limit dùng chung cùng shared Swap secret và replay store để hành vi nhất quán giữa các instance. Hình thái production hiện tại là một Node process trên Pi.

---

## 9. Bản đồ mã nguồn chính

| Khu vực | Đường dẫn |
| --- | --- |
| Tài liệu network ops | `docs/NETWORK_ARCHITECTURE.md` |
| Security headers | `server/securityHeaders.ts` |
| Rate limit / IP client | `server/rateLimit.ts`, `server/helpers/rateLimitHelpers.ts` |
| Swap routes | `server/postApiRoutes.ts` |
| Origin / Content-Type / sanitize lỗi | `server/helpers/apiRoutesHelpers.ts` |
| Admission Web3 POST / sanitize bonding+staking / metadata log swap | `server/helpers/postApiRoutesHelpers.ts` |
| Giới hạn kích thước body | `server/helpers/requestHelpers.ts` (`readJsonBody`) |
| Điều phối quote | `server/loaders/swapQuote.ts` |
| Audit calldata | `server/loaders/swapValidations.ts` |
| HMAC + replay | `server/loaders/swapQuoteVerification.ts` |
| Confirm on-chain | `server/loaders/swapTransactionVerification.ts` |
| Sanitize log | `server/loaders/swapLogs.ts` |
| Server RPC | `server/utils/providers.ts` |
| Hằng số token / router | `constants/swapContracts.ts`, `utils/swapTokens.ts` |
| Frontend RPC | `constants/network.ts` |
| Hook UI swap | `features/swap/hooks/useUniswapQuote.ts`, `features/swap/hooks/useUniswapSwap.ts`, `features/swap/utils/swapTransactionLogs.ts` |
| An toàn receipt / pending dùng chung | `features/web3/transactionConfirmation.ts`, `features/web3/waitForPolygonWalletReceipt.ts`, `features/web3/pendingTransactionStorage.ts`, `server/utils/transactionConfirmationLookup.ts` |
| Constant / server Staking | `constants/stakingContracts.ts`, `server/loaders/stakingAccount.ts`, `server/loaders/stakingQuote.ts`, `server/loaders/stakingTransactionConfirmation.ts` |
| Client Staking | `features/staking/hooks/useStakeTransaction.ts`, `features/staking/hooks/useStakeActions.ts`, `features/staking/utils/permitUtils.ts`, `features/staking/utils/permitConfigGuard.ts`, `features/staking/utils/stakePendingTransactionStorage.ts` |
| Constant / server Bonding | `constants/bonds.ts`, `server/loaders/bondingAccount.ts`, `server/loaders/bondingQuote.ts`, `server/loaders/bondingTransactionConfirmation.ts` |
| Client Bonding | `features/bonding/hooks/useBondTransaction.ts`, `features/bonding/hooks/useBondActions.ts`, `features/bonding/utils/bondQuoteEcho.ts`, `features/bonding/utils/bondPendingTransactionStorage.ts` |
| Validate số nguyên raw | `server/utils/parseUnsignedDecimalRaw.ts`, `server/utils/stakingQuoteUtils.ts`, `server/utils/stakingConfirmationUtils.ts`, `server/utils/bondingReadUtils.ts` |
| Parse swap quote request | `server/utils/swapQuoteRequest.ts` |
| Test server liên quan | `server/tests/apiBoundary.test.ts`, `rateLimit.test.ts`, `securityHeaders.test.ts`, `swapQuote.test.ts`, `swapQuoteRequest.test.ts`, `swapApiAdmission.test.ts`, `swapTransactionVerification.test.ts`, `stakingApi.test.ts`, `bondingApi.test.ts` |
| Test client liên quan | `features/staking/tests/**`, `features/bonding/tests/**` |
