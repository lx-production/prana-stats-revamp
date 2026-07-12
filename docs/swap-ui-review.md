# Swap UI V1 — Review Guide

This document is a map of everything added for the in-app Polygon swap feature. Use it to review the code in a sensible order, from shared definitions up through UI and backend routing.

## What this feature does

- The hero **TRADE** button opens an in-app swap modal instead of linking to Uniswap.
- Users connect an injected wallet (MetaMask, Rabby, etc.) on **Polygon only**.
- The browser asks the **Node backend** for a quote and unsigned transaction data.
- The backend uses **Uniswap Smart Order Router** (and a custom fallback for PRANA routes) with the existing **Alchemy RPC** env var — the API key never goes to the browser.
- The wallet signs **approval** (no need for native POL) and the **swap** transaction locally.
- The backend writes structured swap logs for selected routes, quote failures, and browser-reported approval/swap transaction outcomes.

## Security fixes (applied)

Five hardening changes were added after the initial V1 implementation. Review these before the rest of the swap flow.

1. **Backend calldata validation** (`server/loaders/swapValidations.ts`, called from `server/loaders/swapQuote.ts`)
   - Before any quote is returned, `validateSwapTransaction()` decodes router calldata and walks nested `multicall` batches.
   - Checks: router `to` address, native `value`, allowed recipients (user wallet or router custody), input/min-out amounts, V3 path endpoints (strict on fallback), multicall deadline, nesting depth, and only whitelisted router functions (`exactInput`, `exactInputSingle`, `swapExactTokensForTokens`, `unwrapWETH9`, `sweepToken`, `wrapETH`, `refundETH`).
   - Malformed or unexpected calldata from AlphaRouter is rejected with a generic API error (internal message is not leaked).

2. **Frontend quote staleness guard** (`hooks/useUniswapSwap.ts`, `types/swap.types.ts`)
   - Quote responses now echo `request` metadata (`tokenInSymbol`, `tokenOutSymbol`, `amountInRaw`, `recipient`, `slippageBps`, `chainId`) plus a `deadline`.
   - `isQuoteCurrent` must pass before approve or swap; otherwise the user sees “Refresh the quote before swapping.”
   - `useUniswapQuote` clears the previous quote as soon as inputs change (not only after debounce), so a stale quote cannot sit on screen while the user edits the amount.

3. **Swap API rate limiting** (`server/rateLimit.ts`, wired through `server/postApiRoutes.ts`)
   - Per-IP fixed window: **5** `POST /api/swap/quote` requests / minute (plus **30**/min global), **30** `POST /api/swap/log` / minute.
   - Over limit → `429` with `{ error: "rate_limited", message: "..." }`.

4. **Request body size caps** (`server/helpers/requestHelpers.ts`, `server/postApiRoutes.ts`)
   - `readJsonBody()` enforces a byte limit while streaming (default 16 KB).
   - Swap routes use stricter caps: quote **2 KB**, log **8 KB**. Oversized bodies throw before JSON parse.

5. **Error and log sanitization** (`server/postApiRoutes.ts`, `server/loaders/swapLogs.ts`)
   - `sanitizeSwapErrorMessage()` only forwards a small allowlist of user-facing validation messages; everything else becomes a generic fallback (prevents RPC URLs, stack traces, or Uniswap internals from reaching the browser).
   - `sanitizeLogString()` truncates fields and redacts `http(s)://` URLs and Alchemy API key segments before writing structured logs.

**Also fixed with the security pass:** the WBTC/PRANA fallback now wraps calldata in `multicall(uint256 deadline, bytes[])` (with `unwrapWETH9` for native POL output) so the fallback path carries an on-chain deadline like AlphaRouter quotes.

## Architecture (high level)

```mermaid
flowchart TD
  hero["hero3.tsx TRADE button"] --> modal["SwapModal.tsx"]
  modal --> walletHook["useInjectedWallet"]
  modal --> quoteHook["useUniswapQuote"]
  modal --> swapHook["useUniswapSwap"]
  quoteHook --> api["POST /api/swap/quote"]
  api --> loader["server/loaders/swapQuote.ts"]
  loader --> logs["server/loaders/swapLogs.ts"]
  loader --> alpha["Uniswap AlphaRouter"]
  loader --> fallback["WBTC/PRANA V3 fallback path builder"]
  alpha --> rpc["Alchemy via server/utils/providers.ts"]
  fallback --> rpc
  swapHook --> logApi["POST /api/swap/log"]
  logApi --> logs
  swapHook --> router["Uniswap SwapRouter02 on Polygon"]
  walletHook --> userWallet["Injected wallet"]
  swapHook --> userWallet
```

## New dependencies (`package.json`)

| Package | Role |
| --- | --- |
| `wagmi` | React hooks for wallet connect, chain switch, clients |
| `viem` | Low-level Ethereum types/calls (used by wagmi and formatting) |
| `@tanstack/react-query` | Required by wagmi v2+ |
| `@uniswap/smart-order-router` | Backend route calculation |
| `@uniswap/sdk-core` | Token/currency types for Uniswap SDK |
| `@uniswap/router-sdk`, `@uniswap/v2-sdk`, `@uniswap/v3-sdk` | Peer deps for smart-order-router |
| `@ethersproject/providers` | ethers v5 provider for Uniswap SDK on the server |

Existing packages reused: `ethers`, `framer-motion`, `lucide-react`.

## File inventory

### New and relevant files

| File | Lines (approx) | Purpose |
| --- | --- | --- |
| `types/swap.types.ts` | 152 | All swap-related TypeScript types |
| `constants/swapContracts.ts` | 94 | V1 token list, router addresses, slippage defaults, ERC-20 ABI |
| `utils/wagmiConfig.ts` | 17 | wagmi config: Polygon + injected connectors |
| `utils/swapTokenFormatting.ts` | 33 | Parse/format amounts, compact address, input validation |
| `utils/swapTransactionLogs.ts` | 39 | Fire-and-forget browser reporting to `/api/swap/log` |
| `hooks/useInjectedWallet.ts` | 40 | Connect, disconnect, switch to Polygon |
| `hooks/useUniswapQuote.ts` | 102 | Debounced fetch to `/api/swap/quote` |
| `hooks/useUniswapSwap.ts` | 270 | Balance, allowance, approve, send swap tx; quote staleness guard |
| `components/SwapModal.tsx` | 360 | Modal UI (token pickers, quote, CTA, errors) |
| `server/loaders/swapQuote.ts` | — | Uniswap routing + PRANA fallback orchestration |
| `server/loaders/swapQuoteUtils.ts` | — | Route helpers, path encoding, AlphaRouter loaders |
| `server/loaders/swapValidations.ts` | — | SwapRouter02 calldata validation before quote return |
| `server/loaders/swapLogs.ts` | 130 | Structured swap quote/transaction logging helpers |
| `server/getApiRoutes.ts` | — | Readonly GET API routes (stats, capital, summary, etc.) |
| `server/postApiRoutes.ts` | — | POST-only swap quote/log/verify endpoints |
| `server/rateLimit.ts` | 115 | Swap quote/log per-IP rate limiting |

### Modified files (integration touchpoints)

| File | What changed |
| --- | --- |
| `main.tsx` | Wraps app in `WagmiProvider` + `QueryClientProvider` |
| `hero3.tsx` | TRADE link → button; renders `<SwapModal />` |
| `server/index.ts` | Composes GET/POST API handlers and static handler; swap endpoints live in `server/postApiRoutes.ts` |
| `server/helpers/requestHelpers.ts` | Adds `readJsonBody()` for POST bodies |
| `server/utils/providers.ts` | Adds `getServerPolygonRpcUrl()` export |
| `package.json` / `package-lock.json` | New dependencies |

### Not part of this feature (ignore during review)

- `utils/uniswapV3Helpers.ts` — existing LP math for stats, not swap UI
- `contracts/UniswapV3*.sol` — unrelated to this React swap flow

### Existing file reused (not new)

- `constants/sharedContracts.ts` — `PRANA_ADDRESS`, `WBTC_ADDRESS`, `WBTC_PRANA_V3_POOL`

## V1 supported tokens

Fixed list in `constants/swapContracts.ts` → `V1_SWAP_TOKENS`:

| Symbol | Kind | Notes |
| --- | --- | --- |
| PRANA | ERC-20 | Default output when opening from TRADE |
| WBTC | ERC-20 | Direct V3 pool with PRANA |
| POL | Native | Routes via WMATIC internally |
| USDC | ERC-20 | Native Polygon USDC |
| USDT | ERC-20 | |
| WETH | ERC-20 | |
| DAI | ERC-20 | |

Default pair when modal opens: **WBTC → PRANA** (`DEFAULT_SWAP_TOKEN_IN_SYMBOL` / `DEFAULT_SWAP_TOKEN_OUT_SYMBOL`).

## Recommended review order

Read in this order so each layer builds on the last. Start with **Security fixes (applied)** above for the five hardening changes, then follow the numbered sections below.

### 1. Types — `types/swap.types.ts`

Start here. Everything else imports from this file.

**Look for:**
- `SwapToken`, `SwapQuoteRequest`, `SwapQuoteResponse`, `SwapQuoteRequestMetadata` — API contract between frontend and backend
- `SwapTransactionLogEvent`, `SwapTransactionLogRequest` — browser-to-server transaction log contract
- `SwapTransactionStatus` — UI state machine for approve/swap
- Hook input/output types — keeps components thin

### 2. Constants — `constants/swapContracts.ts`

**Look for:**
- Token addresses and decimals match Polygon mainnet
- `UNISWAP_SWAP_ROUTER_02_ADDRESS` = `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
- `WBTC_PRANA_POOL_ADDRESS` matches existing `sharedContracts.ts`
- `DEFAULT_SWAP_SLIPPAGE_BPS` = 50 (0.5%)
- `SWAP_ERC20_ABI` — minimal approve/allowance/balanceOf for frontend
- `SWAP_ROUTER_02_ABI` — expanded function list used server-side to decode and validate router calldata

### 3. App wiring — `utils/wagmiConfig.ts` + `main.tsx`

**Look for:**
- Only Polygon chain configured
- `injected()` connectors for browser wallets
- `WagmiProvider` wraps the whole app (required for hooks anywhere)

### 4. Backend quote loader — `server/loaders/swapQuote.ts` + `swapQuoteUtils.ts` + `swapValidations.ts`

`swapQuote.ts` orchestrates routing; route/path helpers live in `swapQuoteUtils.ts`; calldata validation lives in `swapValidations.ts`. Budget the most review time here.

**Two paths:**

1. **Primary:** Uniswap `AlphaRouter.route()` → returns `methodParameters` (calldata) when it finds a full route.
2. **Fallback:** `loadWbtcPranaFallbackQuote()` — used when AlphaRouter cannot combine PRANA’s low-liquidity pool with other tokens. It:
   - Routes token → WBTC via AlphaRouter
   - Appends the known WBTC/PRANA V3 pool (1% fee = `10000`)
   - Quotes the combined path via QuoterV2
   - Builds `exactInput` calldata manually

**Critical detail (already fixed once):** SwapRouter02 on Polygon uses `exactInput` **without** a `deadline` in the tuple. Correct selector: `0xb858183f`. Wrong (reverts immediately): `0xc04b8d59`.

**Security (fix #1):** `validateSwapTransaction()` / `validateRouterCall()` in `swapValidations.ts` run on both AlphaRouter and fallback quotes before the response is sent. Budget review time on the allowlist of router functions and recipient/amount checks.

**Also note:**
- `swapQuoteUtils.ts` uses `createRequire()` for Uniswap packages (Node ESM compatibility)
- Alchemy RPC via `getServerPolygonRpcUrl()` — not exposed to browser
- Native POL output uses `multicall(uint256 deadline, bytes[])` + `unwrapWETH9` in fallback path
- Calls `logSwapQuoteRoute()` when a route is selected. Log payload includes source (`alpha_router` or `wbtc_prana_fallback`), token pair, amount in/out, minimum out, slippage, recipient, gas fields, and `routePath`.
- Calls `logSwapQuoteFailure()` for AlphaRouter failures, fallback failures, and final no-route failures.

### 5. API endpoints — `server/postApiRoutes.ts` + `server/rateLimit.ts`

**Look for:**
- `POST` only on `/api/swap/quote`
- Body parsed via `readJsonBody<SwapQuoteRequest>` with **2 KB** cap
- Per-IP rate limit: 10 quote requests / minute → `429 rate_limited`
- Quote errors return JSON `{ error, message }` with 400 status; message passed through `sanitizeSwapErrorMessage()` (fix #5)
- `POST` only on `/api/swap/log`
- Log body parsed via `readJsonBody<unknown>` (**8 KB** cap) and validated by `parseSwapTransactionLogRequest()`
- Per-IP rate limit: 30 log requests / minute
- Transaction logs are accepted as fire-and-forget telemetry from the browser; failed log writes should not block the user's swap flow
- `server/index.ts` should only compose `createGetApiRouteHandler(...)`, `createPostApiRouteHandler(...)`, and `handleStaticRequest(...)`; endpoint behavior should not be duplicated there

### 6. Server helpers — `server/requestHelpers.ts`, `server/utils/providers.ts`

Small changes. Confirm `readJsonBody` streams with a byte cap (default 16 KB; swap routes pass lower limits) and `getServerPolygonRpcUrl` reads the same env vars as the rest of the app (`VITE_ALCHEMY_POLYGON_MAIN` / `POLYGON_RPC_URL`).

### 7. Quote hook — `hooks/useUniswapQuote.ts`

**Look for:**
- Debounce (`SWAP_QUOTE_DEBOUNCE_MS` = 650ms)
- Clears `quote` immediately when inputs change, then debounces the fetch (fix #2 — avoids showing a stale quote while typing)
- Only fetches when wallet connected, on Polygon, amount > 0
- Non-JSON response → clear “restart backend” error (avoids `Unexpected token '<'`)

### 8. Swap execution hook — `hooks/useUniswapSwap.ts`

**Look for:**
- `isQuoteCurrent` compares live modal inputs to `quote.request` + router `to` address before approve/swap (fix #2)
- Reads balance + allowance for ERC-20 input
- `needsApproval` → `approve` on SwapRouter02 before swap (only when quote is current)
- Sends `quote.transaction.to/data/value` from backend unchanged
- Native POL: `value` field on transaction, no approval needed
- Reports approval/swap events through `logSwapTransactionEvent()`:
  `approval_submitted`, `approval_confirmed`, `approval_failed`, `swap_submitted`, `swap_confirmed`, `swap_failed`
- Checks receipt status and treats `reverted` receipts as failures
- `as never` casts on viem calls (typing workaround, not logic)

### 9. Wallet hook — `hooks/useInjectedWallet.ts`

Thin wrapper over wagmi. Connect, disconnect, `ensurePolygon()`.

### 10. Formatting utils — `utils/swapTokenFormatting.ts`

Pure helpers. No side effects.

### 10a. Transaction log helper — `utils/swapTransactionLogs.ts`

Fire-and-forget helper that posts transaction lifecycle events to `/api/swap/log`. It includes the wallet address, tx hash, quote pair, raw/display amounts, minimum amount out, router address, route summary, receipt status, and error message when present. Server-side `parseSwapTransactionLogRequest()` sanitizes string fields and redacts URLs/API keys before logging (fix #5).

### 11. UI component — `components/SwapModal.tsx`

**Look for:**
- Matches site glass/gold style (similar to `Covenants.tsx`)
- Local state: token in/out, amount, slippage (fixed 0.5% for v1)
- Composes the three hooks
- Primary button flow: Connect → Switch network → Approve & Swap → Swap
- On `status === 'success'`, the form is replaced by an in-modal success view with tx hash / Polygonscan link, plus Close and Swap again CTAs
- Route summary, min received, gas estimate display
- Error display for quote errors, swap errors, insufficient balance

### 12. Entry point — `hero3.tsx`

**Look for:**
- `isSwapOpen` state
- TRADE is a `<button>`, not external `<a>`
- `<SwapModal isOpen={...} onClose={...} />` at bottom of section

### 13. Dev proxy — `config/vite.config.js`

Unchanged for swap, but required for local dev: `/api` (and root JSON paths) proxy to `http://localhost:4174`. `npm run serve:dev` sets `PORT=4174` so the API does not collide with port **4173**, which production uses and Cursor preview often binds — hitting the wrong process returns HTML instead of JSON.

Run the local backend with `npm run serve:dev` or `npm run dev:all` (Vite on **5173**, API on **4174**). Production/nginx still targets **4173** via `npm run serve` and `server/index.ts` defaults to **4173** when `PORT` is unset. API handlers are split into `server/getApiRoutes.ts` (readonly GET) and `server/postApiRoutes.ts` (POST swap); `server/index.ts` remains the process entrypoint.

## Request/response shape

**POST `/api/swap/quote`**

```json
{
  "tokenInSymbol": "USDT",
  "tokenOutSymbol": "PRANA",
  "amountIn": "1",
  "recipient": "0x...",
  "slippageBps": 50
}
```

**Response (success):**

```json
{
  "request": {
    "tokenInSymbol": "USDT",
    "tokenOutSymbol": "PRANA",
    "amountIn": "1",
    "recipient": "0x...",
    "slippageBps": 50,
    "amountInRaw": "...",
    "chainId": 137
  },
  "tokenIn": { "symbol": "USDT", ... },
  "tokenOut": { "symbol": "PRANA", ... },
  "amountIn": "1",
  "amountOut": "14.601566589",
  "amountOutRaw": "...",
  "minimumAmountOut": "...",
  "route": [{ "protocol": "V3", "path": ["USDT", "WBTC", "PRANA"], "percent": 100 }],
  "routerAddress": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  "transaction": {
    "to": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    "data": "0xb858183f...",
    "value": "0"
  },
  "deadline": 1710000000,
  "quoteUpdatedAt": "..."
}
```

The frontend never constructs calldata — it only submits `transaction` from the backend quote. It uses `request` + `deadline` to detect stale quotes before signing.

**POST `/api/swap/log`**

```json
{
  "event": "swap_confirmed",
  "ownerAddress": "0x...",
  "tokenInSymbol": "USDT",
  "tokenOutSymbol": "PRANA",
  "amountIn": "1",
  "amountOut": "14.601566589",
  "amountOutRaw": "...",
  "minimumAmountOut": "...",
  "route": [{ "protocol": "V3", "path": ["USDT", "WBTC", "PRANA"], "percent": 100 }],
  "routerAddress": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  "transactionHash": "0x...",
  "receiptStatus": "success"
}
```

The endpoint returns `{ "ok": true }` when the log event is accepted. Client logging is intentionally non-blocking.

**Structured server log examples**

```json
{"scope":"swap","event":"quote_route_selected","source":"wbtc_prana_fallback","routePath":"USDT -> WBTC -> PRANA (100% V3)"}
{"scope":"swap","event":"transaction_event","swapEvent":"swap_confirmed","transactionHash":"0x...","routePath":"USDT -> WBTC -> PRANA (100% V3)"}
```

## Manual test checklist

Run with `npm run dev:all` (or `npm run serve:dev` + `npm run dev`), hard-refresh after deploy.

1. Click **TRADE** → modal opens, default WBTC → PRANA
2. **Connect wallet** on Polygon
3. Enter amount → quote loads (spinner, then output amount)
4. Check **route** section shows sensible path
5. **USDT → PRANA** (exercises fallback path + approval)
6. **WBTC → PRANA** (direct pool, AlphaRouter path)
7. **PRANA → USDC** (reverse fallback)
8. **POL → PRANA** (native input, `value` on tx)
9. Approve flow for ERC-20 (button shows “Approve & Swap” first)
10. Complete a small swap and confirm on Polygonscan
11. Wrong network → “Switch to Polygon”
12. Backend stopped → friendly error, not JSON parse error
13. Change amount after quote loads → quote clears immediately; swap blocked until new quote arrives
14. Spam quote endpoint → eventually `429 rate_limited`
15. Local server terminal shows `"scope":"swap"` logs for quote route selection and transaction events
16. Production service logs show swap entries with `sudo journalctl -u prana-stats-revamp.service -f | grep '"scope":"swap"'`

## Known limitations (V1)

- Fixed 7-token list only; no custom token import
- Slippage hardcoded to 0.5% in UI (not user-adjustable yet)
- No quote expiry UI warning (backend sets a 20-minute `deadline` on both AlphaRouter and fallback multicall calldata; frontend checks input match but not deadline age yet)
- Bundle size increased (~1.1 MB JS) due to wagmi/viem
- `swapQuote.ts` uses `any` for Uniswap SDK types (SDK is ethers v5, app is ethers v6)
- Transaction result logs depend on the browser successfully posting `/api/swap/log`; route quote logs are server-side and do not depend on the browser after the quote request
- Production deploy requires **rebuild + restart** `prana-stats-revamp.service` so `/api/swap/quote` and `/api/swap/log` exist in the running server

## Quick smoke test (terminal)

```bash
# After npm run serve:dev is running (listens on 4174):
curl -s -X POST http://localhost:4174/api/swap/quote \
  -H 'content-type: application/json' \
  -d '{"tokenInSymbol":"USDT","tokenOutSymbol":"PRANA","amountIn":"1","recipient":"0x000000000000000000000000000000000000dEaD","slippageBps":50}' \
  | head -c 200

# Or through the Vite dev proxy (npm run dev:all):
curl -s -X POST http://localhost:5173/api/swap/quote \
  -H 'content-type: application/json' \
  -d '{"tokenInSymbol":"USDT","tokenOutSymbol":"PRANA","amountIn":"1","recipient":"0x000000000000000000000000000000000000dEaD","slippageBps":50}' \
  | head -c 200
```

Expect JSON with `"amountOut"` and transaction `data` starting with `0xb858183f`.

To inspect local logs while testing swaps:

```bash
npm run serve:dev
```

For production service logs:

```bash
sudo journalctl -u prana-stats-revamp.service -f | grep '"scope":"swap"'
```

## Latest hardening updates from follow-up review

The original V1 notes above are useful for understanding the initial swap implementation, but a few security hardening changes have since been applied.

### Security headers on all served responses

`server/securityHeaders.ts` now defines a shared `setSecurityHeaders()` helper used by:

- `server/requestHelpers.ts` for `sendJson()` and `sendText()`;
- `server/serveFile.ts` for static assets and HTML, including `304 Not Modified` responses.

Every server response now includes:

- `Content-Security-Policy`;
- `X-Frame-Options: DENY`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`.

The CSP is scoped to the current app shape: same-origin app/API/assets, Google-hosted `model-viewer`, same-origin GLB model files, inline style attributes used by the UI layer, and the public Polygon RPC used by the frontend wagmi config.

### Swap logs split into telemetry vs verified confirmation

The old V1 statement that browser transaction logs include `swap_confirmed` should now be read as historical. `/api/swap/log` is treated as untrusted telemetry only and no longer accepts `swap_confirmed` as a normal client-submitted event.

Current flow:

1. `/api/swap/quote` returns the normal quote plus `verification`, a short-lived HMAC token over the quote metadata and exact transaction fields (`to`, `data`, `value`).
2. The browser still logs untrusted lifecycle telemetry such as `approval_submitted`, `approval_confirmed`, `approval_failed`, `swap_submitted`, and `swap_failed`.
3. When the browser sees a successful swap receipt, `utils/swapTransactionLogs.ts` sends the transaction hash and signed quote to `/api/swap/verify-transaction` instead of `/api/swap/log`.
4. `server/loaders/swapTransactionVerification.ts` verifies the quote token, fetches the Polygon transaction/receipt through the server RPC, and checks sender, router target, successful receipt status, calldata, and native value.
5. Only after those checks pass does the server write `transaction_event_verified` with `swapEvent: "swap_confirmed"`.

This means fake browser posts can still attempt to send telemetry, but they cannot create a trusted confirmed-swap record without a real successful Polygon transaction that exactly matches a server-issued quote.

### Swap API request hardening

The swap JSON endpoints now reject invalid browser requests before body parsing:

- missing or non-JSON `Content-Type` returns `415 unsupported_media_type`;
- cross-origin browser requests return `403 forbidden_origin`;
- localhost dev proxy traffic is allowed;
- forwarded hosts are considered so the check works behind a normal reverse proxy.

This closes the easy `no-cors` log-spam path. It is defense-in-depth; trusted swap confirmation still comes from on-chain verification, not from browser claims.

### Operational note

Quote verification uses a random per-process HMAC secret (`SIGNING_SECRET`). Tokens are invalid after a process restart and cannot be verified across multiple workers — the same tradeoff as the in-memory replay cache. Fine for a single Node process; revisit if you run multiple instances.
