# Security Overview — Node App & Swap Modal

This document describes the security-related mechanisms currently implemented in the Node app and the in-app Polygon swap modal. It is a factual inventory of how the system works today, based on the codebase.

Production network path (VPS, reverse SSH tunnel, Pi nginx, edge TLS/rate limits) is documented in [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md).

Related docs:

- [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md) — VPS ↔ Pi reverse tunnel and edge nginx
- [`swap-modal-technical-overview.md`](./swap-modal-technical-overview.md) — swap feature end-to-end

---

## 1. Node HTTP security headers

Applied to API and static responses via `setSecurityHeaders()` (`server/securityHeaders.ts`), called from `requestHelpers.ts` and `serveFile.ts`.

| Header | Behavior |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; `base-uri 'self'`; `object-src 'none'`; `frame-ancestors 'none'`; scripts from `'self'` plus Google model-viewer/Draco hosts with `'wasm-unsafe-eval'`; `style-src 'self' 'unsafe-inline'`; `img-src` / `font-src` `'self' data:`; `connect-src` same-origin + `blob:` + frontend Polygon RPC (`https://polygon.drpc.org`) + model-viewer hosts; `worker-src 'self' blob:`; `form-action 'self'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

---

## 2. Swap modal — security model

### 2.1 Scope constraints (V1)

- **Chain:** Polygon mainnet only (`chainId` `137`).
- **Tokens:** fixed allowlist of seven symbols (`PRANA`, `WBTC`, `POL`, `USDC`, `USDT`, `WETH`, `DAI`) via `V1_SWAP_TOKENS` / `getSwapToken()`.
- **Router:** Uniswap SwapRouter02 on Polygon ([`0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`](https://polygonscan.com/address/0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45#tokentxns)).
- **Slippage UI:** fixed at `50` bps (0.5%) in the modal; server clamps requested bps to `[1, 500]` via `getValidatedSlippageBps()`.
- **Wallet:** injected connectors only (wagmi); no WalletConnect / LiFi / 0x / RainbowKit.
- **Calldata source:** browser never builds swap calldata; it submits `quote.transaction.{to, data, value}` from the server response.

### 2.2 RPC split

| Consumer | RPC | Location |
| --- | --- | --- |
| Browser (balances, allowance, send/wait) | Public `https://polygon.drpc.org` | `constants/network.ts` → wagmi/viem |
| Server (AlphaRouter, QuoterV2, verify) | `VITE_ALCHEMY_POLYGON_MAIN` or `POLYGON_RPC_URL`, else `polygon-rpc.com` | `server/utils/providers.ts` |

Private Alchemy (or other) keys stay on the server process. CSP `connect-src` allows the public frontend RPC host for browser fetches.

### 2.3 API surface

All swap endpoints are POST-only, JSON body, same-origin checks, body size caps, and per-IP rate limits (`server/postApiRoutes.ts`, `server/rateLimit.ts`, `server/helpers/apiRoutesHelpers.ts`).

| Endpoint | Purpose | Body cap | Rate limit |
| --- | --- | --- | --- |
| `POST /api/swap/quote` | Route + unsigned tx + HMAC | 2 KB | 5 / IP / min + 30 global / min |
| `POST /api/swap/log` | Untrusted lifecycle telemetry | 8 KB | 30 / IP / min |
| `POST /api/swap/verify-transaction` | On-chain proof → verified `swap_confirmed` log | 32 KB | 10 / IP / min |

Rate limiters use fixed windows in process memory, with periodic bucket cleanup.

Client IP for rate limiting (`server/rateLimit.ts`): `X-Forwarded-For` is only trusted when the direct socket peer is a localhost proxy (`127.0.0.1` / `::1`). The client IP is then taken by counting hops from the right of the header (`TRUSTED_PROXY_HOP_COUNT`; production uses `2` because both VPS and Pi nginx append — see [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md)). Otherwise the socket address is used.

### 2.4 Request admission checks

Before handling a swap POST body, `rejectInvalidSwapApiRequest()`:

1. Requires `Content-Type` matching JSON (`application/json` or `*+json`).
2. If `Origin` is present, requires it to match the request `Host` / `X-Forwarded-Host` candidates (with a localhost-to-localhost exception for local dev). Missing `Origin` is allowed (non-browser clients). Mismatch → `403 forbidden_origin`.

`readJsonBody()` enforces the per-route byte cap and rejects empty bodies.

### 2.5 Quote pipeline (`server/loaders/swapQuote.ts`)

1. Resolve tokens from the allowlist; reject same-token pairs, invalid recipients, non-positive amounts.
2. Primary route: Uniswap AlphaRouter (`SwapType.SWAP_ROUTER_02`) against the server Polygon RPC.
3. Fallback (PRANA pairs when AlphaRouter has no usable route): stitch via known WBTC/PRANA V3 pool; wrap in `multicall(deadline, …)`; may include `unwrapWETH9` for native POL out.
4. `validateSwapTransaction()` before return.
5. `attachSwapQuoteVerification()` (HMAC).
6. Structured server logs for selected routes and failures.

### 2.6 Calldata validation (`server/loaders/swapValidations.ts`)

Before a quote is returned to the client, the server decodes SwapRouter02 calldata (including nested `multicall`) and checks:

- `transaction.to` is SwapRouter02
- Native `value` equals `amountIn` for native POL in, otherwise `0`
- Recipients are the user wallet, the router, or SwapRouter02 sentinel addresses (`msg.sender` / `address(this)`)
- Input amounts and min-out where applicable; cumulative input budget across legs
- V3 path endpoints (strict mode for fallback quotes)
- Multicall deadline matches the quote deadline; nesting depth ≤ 4
- Only allowlisted router methods: `exactInput`, `exactInputSingle`, `swapExactTokensForTokens`, `wrapETH`, `unwrapWETH9`, `sweepToken`, `refundETH`, and `multicall`

Unsupported or unexpected calldata causes quote failure. Client-facing errors are sanitized (see below).

### 2.7 Quote HMAC and replay guard (`server/loaders/swapQuoteVerification.ts`)

- After a successful quote, the server attaches `verification` with `version` (currently `2`), `issuedAt`, `expiresAt` (5-minute TTL), and an HMAC-SHA256 `token`.
- Signed payload covers normalized quote fields: request metadata, tokens/amounts, route, router, transaction `{to, data, value}`, deadline. Addresses/calldata are lowercased; object keys are stable-stringified.
- Signing secret is a **process-local** `randomBytes(32)` value (regenerated on restart).
- Verification uses `timingSafeEqual` on hex-decoded digests.
- In-memory replay map stores `sha256(token)` → expiry; `assertSwapQuoteTokenUnused` runs before RPC; `markSwapQuoteTokenUsed` runs only after successful on-chain verification and verified log write.

### 2.8 On-chain verification (`server/loaders/swapTransactionVerification.ts`)

Used when the client reports a confirmed swap. Flow:

1. Parse body: owner address, 32-byte tx hash, full quote object.
2. `verifySwapQuoteToken` (HMAC + expiry).
3. Shape checks: Polygon chainId, recipient matches owner, router/`to` are SwapRouter02.
4. Replay guard (unused token).
5. Load tx + receipt from server Polygon RPC.
6. Assert receipt success, sender = owner, `to` = router, calldata and value match the signed quote.
7. Write verified `swap_confirmed` log; mark token used.

Clients cannot produce a verified confirmation log without a matching on-chain transaction for a server-signed quote.

### 2.9 Logging vs telemetry

- `/api/swap/log` accepts browser events: `approval_*`, `swap_submitted`, `swap_failed` (and related). Treated as untrusted telemetry.
- Confirmed swaps from the browser are routed client-side (`features/swap/utils/swapTransactionLogs.ts`) to `/api/swap/verify-transaction` instead of the plain log endpoint.
- Server logs (`server/loaders/swapLogs.ts`) redact `http(s)://` URLs and Alchemy key-like path segments; truncate string fields; attach sanitized request metadata (IP, host, origin, user-agent).

### 2.10 Error sanitization (`sanitizeSwapErrorMessage`)

Only a fixed allowlist of validation messages is returned to the client. Other errors (including RPC/Uniswap internals) become a generic fallback string. Syntax errors map to “Invalid JSON request body.”

---

## 3. Frontend swap guards

Implemented mainly in `features/swap/hooks/useUniswapQuote.ts` and `features/swap/hooks/useUniswapSwap.ts`.

| Mechanism | Behavior |
| --- | --- |
| Debounced quoting | 650 ms after input settles; previous quote cleared when inputs change |
| Quote deadline | `SWAP_DEADLINE_SECONDS` = 3 minutes on-chain deadline in router calldata |
| Expiry buffer | Swap blocked if deadline is within 5 seconds |
| Request echo | Quote response includes request metadata; frontend requires match on chainId, tokens, `amountInRaw`, recipient, slippage, router/`to` before approve/swap |
| Manual refresh cooldown | 60 seconds |
| Network gate | `ensurePolygon()` switches injected wallet to chain `137` when needed |
| Approvals | Exact `amountInRaw` approve to SwapRouter02 when allowance is insufficient (not unlimited); native POL skips approve |
| Execution | `walletClient.sendTransaction` with server-provided `to` / `data` / `value`; reverted receipts treated as failure |

Wallet connection uses the first available injected connector (`useInjectedWallet`).

---

## 4. Build / deploy identity (ops visibility)

Not an access-control control, but relevant to knowing what binary is live:

- Footer / `GET /api/version` expose git tag and/or short commit (and dirty `*` marker when the checkout was dirty at identity resolution).
- UI identity is baked at `vite build`; `/api/version` is resolved at Node process start.

Documented in [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md) §7.

---

## 5. Process-local state (operational note)

These swap security state stores live in a single Node process memory and are not shared across workers or restarts:

- Per-IP / global rate-limit buckets
- HMAC signing secret
- Quote-token replay cache

Multi-instance deploys would need a shared secret and shared replay store for HMAC/replay behavior to be consistent across instances. Current production shape is a single Node process on the Pi.

---

## 6. Key source map

| Area | Paths |
| --- | --- |
| Network ops docs | `docs/NETWORK_ARCHITECTURE.md` |
| Security headers | `server/securityHeaders.ts` |
| Rate limits / client IP | `server/rateLimit.ts` |
| Swap routes | `server/postApiRoutes.ts` |
| Origin / Content-Type / error sanitize | `server/helpers/apiRoutesHelpers.ts` |
| Body size limits | `server/helpers/requestHelpers.ts` (`readJsonBody`) |
| Quote orchestration | `server/loaders/swapQuote.ts` |
| Calldata audit | `server/loaders/swapValidations.ts` |
| HMAC + replay | `server/loaders/swapQuoteVerification.ts` |
| On-chain confirm | `server/loaders/swapTransactionVerification.ts` |
| Log sanitization | `server/loaders/swapLogs.ts` |
| Server RPC | `server/utils/providers.ts` |
| Token / router constants | `constants/swapContracts.ts`, `utils/swapTokens.ts` |
| Frontend RPC | `constants/network.ts` |
| Swap UI hooks | `features/swap/hooks/useUniswapQuote.ts`, `features/swap/hooks/useUniswapSwap.ts`, `features/swap/utils/swapTransactionLogs.ts` |
| Related tests | `server/tests/apiBoundary.test.ts`, `rateLimit.test.ts`, `securityHeaders.test.ts`, `swapQuote.test.ts`, `swapTransactionVerification.test.ts`, `swapLogs.test.ts` |
