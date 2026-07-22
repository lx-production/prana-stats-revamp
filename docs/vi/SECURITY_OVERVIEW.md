# Tổng quan bảo mật — Node App & Swap Modal

Tài liệu này mô tả các cơ chế liên quan đến bảo mật hiện đang được triển khai trong Node app và swap modal Polygon trong ứng dụng. Đây là bản liệt kê thực tế về cách hệ thống hoạt động hiện nay, dựa trên codebase.

Đường dẫn mạng production (VPS, reverse SSH tunnel, Pi nginx, TLS/rate limit ở edge) được ghi trong [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md).

Tài liệu liên quan:

- [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md) — reverse tunnel VPS ↔ Pi và nginx ở edge
- [`swap-modal-technical-overview.md`](./swap-modal-technical-overview.md) — swap feature end-to-end
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

### 2.3 Bề mặt API

Mọi endpoint swap đều chỉ nhận POST, body JSON, kiểm tra same-origin, giới hạn kích thước body, và rate limit theo IP (`server/postApiRoutes.ts`, `server/rateLimit.ts`, `server/helpers/apiRoutesHelpers.ts`).

| Endpoint | Mục đích | Giới hạn body | Rate limit |
| --- | --- | --- | --- |
| `POST /api/swap/quote` | Route + unsigned tx + HMAC | 2 KB | 5 / IP / phút + 30 global / phút |
| `POST /api/swap/log` | Telemetry vòng đời (không tin cậy) | 8 KB | 30 / IP / phút |
| `POST /api/swap/verify-transaction` | Chứng minh on-chain → log `swap_confirmed` đã verify | 32 KB | 10 / IP / phút |

Rate limiter dùng cửa sổ thời gian cố định trong bộ nhớ process, kèm dọn bucket định kỳ.

IP client cho rate limiting (`server/rateLimit.ts`): chỉ tin `X-Forwarded-For` khi peer socket trực tiếp là proxy localhost (`127.0.0.1` / `::1`). Khi đó IP client được lấy bằng cách đếm hop từ bên phải của header (`TRUSTED_PROXY_HOP_COUNT`; production dùng `2` vì cả VPS lẫn Pi nginx đều append — xem [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md)). Nếu không, dùng địa chỉ socket.

### 2.4 Kiểm tra trước khi nhận request

Trước khi xử lý body POST của swap, `rejectInvalidSwapApiRequest()`:

1. Yêu cầu `Content-Type` khớp JSON (`application/json` hoặc `*+json`).
2. Nếu có header `Origin`, yêu cầu nó khớp với các ứng viên `Host` / `X-Forwarded-Host` của request (có ngoại lệ localhost-to-localhost cho local dev). Thiếu `Origin` thì được phép (client không phải browser). Không khớp → `403 forbidden_origin`.

`readJsonBody()` áp dụng giới hạn byte theo từng route và từ chối body rỗng.

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
| Debounce quote | 650 ms sau khi input ổn định; xóa quote cũ ngay khi input đổi |
| Deadline quote | `SWAP_DEADLINE_SECONDS` = 3 phút deadline on-chain trong router calldata |
| Buffer hết hạn | Chặn swap nếu deadline còn trong vòng 5 giây |
| Echo request | Response quote gồm metadata request; frontend yêu cầu khớp chainId, token, `amountInRaw`, recipient, slippage, router/`to` trước khi approve/swap |
| Cooldown refresh thủ công | 60 giây |
| Cổng mạng | `ensurePolygon()` chuyển injected wallet sang chain `137` khi cần |
| Approval | Approve đúng `amountInRaw` cho SwapRouter02 khi allowance chưa đủ (không unlimited); native POL bỏ qua approve |
| Execution | `walletClient.sendTransaction` với `to` / `data` / `value` do server cung cấp; receipt reverted được coi là thất bại |

Kết nối ví dùng injected connector đầu tiên có sẵn (`features/web3/useInjectedWallet`).

---

## 4. Định danh build / deploy (quan sát vận hành)

Không phải cơ chế access-control, nhưng hữu ích để biết binary nào đang chạy:

- Footer / `GET /api/version` lộ git tag và/hoặc short commit (và dấu `*` dirty khi checkout bị dirty lúc resolve identity).
- Identity UI được bake lúc `vite build`; `/api/version` được resolve khi Node process khởi động.

Được ghi trong [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md) §7.

---

## 5. State local theo process (ghi chú vận hành)

Các store trạng thái bảo mật của swap sống trong bộ nhớ của một Node process và không chia sẻ giữa workers hay sau restart:

- Bucket rate-limit theo IP / global
- HMAC signing secret
- Cache replay token quote

Deploy nhiều instance sẽ cần shared secret và shared replay store để hành vi HMAC/replay nhất quán giữa các instance. Hình thái production hiện tại là một Node process trên Pi.

---

## 6. Bản đồ mã nguồn chính

| Khu vực | Đường dẫn |
| --- | --- |
| Tài liệu network ops | `docs/NETWORK_ARCHITECTURE.md` |
| Security headers | `server/securityHeaders.ts` |
| Rate limit / IP client | `server/rateLimit.ts` |
| Swap routes | `server/postApiRoutes.ts` |
| Origin / Content-Type / sanitize lỗi | `server/helpers/apiRoutesHelpers.ts` |
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
| Test liên quan | `server/tests/apiBoundary.test.ts`, `rateLimit.test.ts`, `securityHeaders.test.ts`, `swapQuote.test.ts`, `swapTransactionVerification.test.ts`, `swapLogs.test.ts` |
