# Manual Swap And Server Review Guide

Use this as the working checklist for manually reviewing the in-app Polygon swap flow, the server split, and all hardening mentioned in:

- `docs/swap-ui-review.md`
- `docs/server-review.md`
- `docs/fable-5-max-review.md`

The current code appears to include the later refactor notes from `fable-5-max-review.md`, so treat NEW-1 through NEW-5 as "verify the fix still holds" tasks, not automatically-open bugs. If you find a mismatch between a doc and the code, prefer the code as the source of truth, then update the docs or code intentionally.

## Review Rules

- Preserve behavior unless you are deliberately fixing a confirmed issue.
- Separate findings from cleanup. A readability refactor is not a security finding.
- For every code change, write down the route, hook, or invariant it affects.
- For swap security, follow the trust boundary: browser input is untrusted, server quotes are signed, wallet signatures are final, confirmed swaps must be verified on-chain.
- When unsure, add a small test before refactoring.

## Quick Map

| Area | Primary files |
| --- | --- |
| App and wallet setup | `main.tsx`, `utils/wagmiConfig.ts`, `hooks/useInjectedWallet.ts` |
| Swap UI | `hero3.tsx`, `components/SwapModal.tsx` |
| Quote hook | `hooks/useUniswapQuote.ts` |
| Swap execution | `hooks/useUniswapSwap.ts`, `utils/swapTransactionLogs.ts` |
| Swap types and constants | `types/swap.types.ts`, `constants/swapContracts.ts`, `constants/network.ts` |
| Quote backend | `server/loaders/swapQuote.ts`, `server/loaders/swapQuoteUtils.ts`, `server/loaders/swapValidations.ts` |
| Quote signing and verification | `server/loaders/swapQuoteVerification.ts`, `server/loaders/swapTransactionVerification.ts` |
| Logs | `server/loaders/swapLogs.ts` |
| API boundary | `server/getApiRoutes.ts`, `server/postApiRoutes.ts`, `server/helpers/requestHelpers.ts` |
| Rate limits | `server/rateLimit.ts`, `server/rateLimit.test.ts` |
| Server split | `server/index.ts`, `server/staticRoutes.ts`, `server/serverStartup.ts` |
| Static and cache behavior | `server/serveFile.ts`, `server/cacheControl.ts`, `constants/cachePolicy.ts` |
| Security headers | `server/securityHeaders.ts`, `server/securityHeaders.test.ts` |

## Setup

1. Check the working tree first:

```bash
git status --short
```

2. Install dependencies only if needed:

```bash
npm install
```

3. Know the two local server modes:

```bash
npm run serve      # server on 127.0.0.1:4173
npm run dev:all    # API on 4174, Vite frontend on 5173
```

4. Expected production deployment detail:

```bash
TRUSTED_PROXY_HOP_COUNT=2
```

This matters for the documented VPS nginx -> Pi nginx -> Node chain.

## Phase 1: Baseline Verification

- [ ] Run the focused tests before changing code:

```bash
npm run test:rate-limit
node --import tsx --test server/tests/apiBoundary.test.ts
node --import tsx --test server/tests/swapQuote.test.ts
node --import tsx --test server/tests/swapLogs.test.ts
node --import tsx --test server/tests/swapTransactionVerification.test.ts
node --import tsx --test server/tests/securityHeaders.test.ts
npm run typecheck
npm run build
```

- [ ] If a command fails, record whether it is a real code issue, a missing env var, a Node version issue, or a local dependency issue.
- [ ] Note that root `tsconfig.json` excludes server paths (`npm run typecheck` is frontend-only). Use `tsc -p server --noEmit` for server types, or the focused `node --import tsx --test ...` commands for runtime import checks.

## Phase 2: Server Shape And Route Order

Review `server/index.ts` first. It should stay small.

- [x] `PORT` defaults to `4173`.
- [x] `HOST` defaults to `127.0.0.1`.
- [x] `createSwapRateLimiters()` is called once.
- [x] `startCleanupTimer()` is called once during startup.
- [x] Request order is API first, static second, final JSON `404`.
- [x] Top-level error handler logs `Server error:` and returns `{ "error": "internal_error" }`.
- [x] `warmApiCaches()` runs after `server.listen(...)` and does not block accepting requests.

Minor refactor candidates:

- [x] Keep `server/index.ts` composition-only. Move behavior into route/helper modules.
- [x] Avoid adding endpoint-specific logic to `server/index.ts`.
- [x] Consider a route table only if `server/getApiRoutes.ts` or `server/postApiRoutes.ts` grows further; do not abstract just for symmetry.

## Phase 3: Static Files, Root JSON, And Cache Headers

Review `server/staticRoutes.ts`, `server/serveFile.ts`, `server/cacheControl.ts`, and `constants/cachePolicy.ts`.

- [x] Preserve static route order:
  1. root `data_*.json`
  2. root `bonds_v2.json`
  3. root `buy_dips.json`
  4. `/prana-coin-fallback.png` mapped to `public/assets/icons/prana.svg`
  5. `dist` files
  6. `public` files
  7. `dist/index.html` SPA fallback
- [x] Root JSON misses return JSON `404`.
- [x] Non-API app paths can fall back to `dist/index.html`.
- [x] `.html` responses use `no-cache`.
- [x] root JSON files use short public cache.
- [x] hashed `dist/assets/*`, `prana-coin-fallback.png`, and `prana-coin.glb` use long immutable cache.
- [x] `serveFile` sets security headers before both `200` and `304` responses.

Manual smoke checks:

```bash
curl -i http://127.0.0.1:4174/api/summary | head
curl -i http://127.0.0.1:4174/api/prana-stats | head
curl -i http://127.0.0.1:4174/api/staking-stats | head
curl -i http://127.0.0.1:4174/bonds_v2.json | head
curl -i http://127.0.0.1:4174/prana-coin-fallback.png | head
```

## Phase 4: API Boundary

Review `server/getApiRoutes.ts`, `server/postApiRoutes.ts`, and `server/helpers/requestHelpers.ts`.

- [x] All read-only API paths still exist (in `getApiRoutes.ts`):
  - `/api/summary`
  - `/api/top-holding-addresses`
  - `/api/prana-stats`
  - `/api/staking-stats`
  - `/api/capital`
  - `/api/lp-capital`
  - `/api/bond-metrics`
- [x] Swap POST paths still exist (in `postApiRoutes.ts`):
  - `/api/swap/quote`
  - `/api/swap/log`
  - `/api/swap/verify-transaction`
- [x] Read-only cache headers match `docs/server-review.md`.
- [x] `/api/summary` returns `text/markdown; charset=utf-8`.
- [x] Swap endpoints reject non-POST methods with JSON `405`.
- [x] Swap endpoints reject non-JSON bodies with `415 unsupported_media_type`.
- [x] Swap endpoints reject cross-origin browser requests with `403 forbidden_origin`.
- [x] Body caps are still:
  - quote: `2048` bytes
  - log: `8192` bytes
  - verify-transaction: `32768` bytes
- [x] `readJsonBody()` enforces size while streaming, before JSON parse completes.
- [x] `sanitizeSwapErrorMessage()` only exposes the intended allowlist plus `SyntaxError` mapped to `Invalid JSON request body.`
- [x] Backend quote failures that are intentionally hidden from the browser still leave enough structured server log context to debug.
- [x] Swap route handlers build server-only log metadata through `createSwapRequestLogMetadata()`, not from browser-submitted JSON.
- [x] `/api/swap/quote`, `/api/swap/log`, and `/api/swap/verify-transaction` all pass request metadata into their swap log path.
- [x] Request metadata includes derived `clientIp`, request host, origin, and user agent.

Manual boundary checks:

```bash
curl -i -X GET http://127.0.0.1:4174/api/swap/quote | head
curl -i -X GET http://127.0.0.1:4174/api/swap/verify-transaction | head
curl -i -X POST http://127.0.0.1:4174/api/swap/quote --data '{}' | head
curl -i -X POST http://127.0.0.1:4174/api/swap/quote -H 'Content-Type: text/plain' --data '{}' | head
```

Minor refactor candidates:

- [x] Extract repeated swap endpoint guards only if it improves readability without hiding status codes.
- [x] Consider a small helper for `method_not_allowed` responses.
- [x] Keep sanitization local and explicit; do not pass raw server errors through to the browser.

## Phase 5: Rate Limit Trust Boundary

Review `server/rateLimit.ts` and `server/rateLimit.test.ts`.

- [x] Direct clients use `req.socket.remoteAddress`.
- [x] Direct clients cannot choose a bucket with `X-Forwarded-For`.
- [x] `X-Forwarded-For` is trusted only when the immediate socket address is localhost (`127.0.0.1` or `::1`).
- [x] IPv4-mapped IPv6 addresses are normalized.
- [x] `getClientIp(req)` exposes the same trusted-proxy identity used by the rate-limit buckets.
- [x] `TRUSTED_PROXY_HOP_COUNT` defaults to `1`.
- [x] With `TRUSTED_PROXY_HOP_COUNT=2`, `"<real client>, 127.0.0.1"` resolves to the real client.
- [x] Spoofed prepended XFF values do not shift the two-hop result.
- [x] Per-IP quote limit is `5/min`.
- [x] Global quote limit is `30/min`.
- [x] Log limit is `30/min`.
- [x] Verify limit is independent and `10/min`.
- [x] Per-IP quote rejections do not spend the global quote budget.
- [x] Cleanup timer sweeps quote, global quote, log, and verify buckets.
- [x] Cleanup timer is `unref()`ed.

Deployment check:

- [x] Confirm the production Node service sets `TRUSTED_PROXY_HOP_COUNT=2`.

Minor refactor candidates:

- [x] Name rate-limit constants in a way that mirrors endpoint names.
- [x] If future endpoints need limits, add tests before adding new buckets.
- [x] Do not persist rate-limit buckets unless there are multiple Node instances or restart-surviving abuse becomes a real problem.

## Phase 6: Security Headers And Frontend RPC Host

Review `constants/network.ts`, `utils/wagmiConfig.ts`, and `server/securityHeaders.ts`.

- [x] `FRONTEND_POLYGON_RPC_URL` is the single browser RPC source of truth.
- [x] `wagmiConfig` uses `http(FRONTEND_POLYGON_RPC_URL)`, not viem's implicit default.
- [x] CSP `connect-src` includes exactly the pinned browser RPC host plus `'self'`.
- [x] CSP does not include stale `https://polygon-rpc.com` unless that is intentionally the pinned host.
- [x] CSP `img-src` is tight: `'self' data:`.
- [x] CSP includes `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, and `form-action 'self'`.
- [x] `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin` are set on JSON, text, static files, and `304`.

Minor refactor candidates:

- [x] Keep browser RPC config separate from server/private RPC provider config.
- [x] If external runtime images are added later, update `img-src` with explicit hosts instead of returning to broad `https:`.

## Phase 7: Swap Types And Constants

Review `types/swap.types.ts` and `constants/swapContracts.ts`.

- [x] Token list is Polygon mainnet only.
- [x] PRANA, WBTC, USDC, USDT, WETH, DAI addresses and decimals match intended Polygon contracts.
- [x] Native POL uses `kind: 'native'` and `wrappedAddress: WMATIC_ADDRESS`.
- [x] `UNISWAP_SWAP_ROUTER_02_ADDRESS` is `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`.
- [x] `UNISWAP_V3_QUOTER_V2_ADDRESS` matches the smart-order-router Polygon quoter used by this dependency version.
- [x] `SWAP_DEADLINE_SECONDS` is intentionally short, currently `3 * 60`.
- [x] `DEFAULT_SWAP_SLIPPAGE_BPS` is `50`.
- [x] `SWAP_ROUTER_02_ABI` includes only allowed router functions.
- [x] Deadline-less `multicall(bytes[])` is not accepted in the main decode ABI.
- [x] Type contracts include quote request metadata and verification token fields.

Minor refactor candidates:

- [x] If token metadata grows, consider moving token list construction to `utils/swapTokens.ts` or a dedicated token registry.
- [x] Keep comments on Uniswap selector quirks near the ABI or calldata builder.

## Phase 8: Backend Quote Loader

Review `server/loaders/swapQuote.ts`, `server/loaders/swapQuoteUtils.ts`, and `server/loaders/swapValidations.ts`. This is the highest-risk area.

Primary route:

- [x] `AlphaRouter.route()` uses the server-side provider/RPC path only.
- [x] Alchemy/private RPC keys are never returned to the browser.
- [x] Returned `methodParameters` exist before building a response.
- [x] AlphaRouter errors are logged internally but exposed generically.
- [x] AlphaRouter calldata validation failures are logged as `stage: "alpha_router_validation"` before returning the generic quote failure to the browser.

WBTC/PRANA fallback:

- [x] Fallback is used only for intended low-liquidity PRANA cases.
- [x] Route to/from WBTC is loaded through AlphaRouter where needed.
- [x] Known WBTC/PRANA V3 pool fee is `10000`.
- [x] Combined V3 path starts and ends with the requested tokens.
- [x] QuoterV2 output is used to compute `amountOutRaw`.
- [x] Fallback calldata uses SwapRouter02 `exactInput` without a tuple deadline.
- [x] Fallback wraps calls in `multicall(uint256 deadline, bytes[])`.
- [x] Native POL output path includes unwrap behavior where needed.

Validation:

- [x] `validateSwapTransaction()` runs on every quote path before response.
- [x] Transaction `to` is exactly SwapRouter02.
- [x] Native `value` is correct for token-in kind.
- [x] Allowed recipients are user wallet, router custody, or SwapRouter02 sentinel recipients `address(1)` / `address(2)`.
- [x] Native POL output allows the expected `address(2)` temporary recipient followed by `unwrapWETH9(..., user)`.
- [x] Router function allowlist is narrow.
- [x] Nested multicall depth is capped.
- [x] Empty multicalls are rejected.
- [x] Deadline-less multicall is rejected.
- [x] Deadline is enforced.
- [x] V3 path endpoints are strict where expected.
- [x] Each swap call amount is checked.
- [x] Cumulative input across nested multicalls is checked.
- [x] Returned `minimumAmountOut` matches or is protected by calldata min-out checks.
- [x] Route logs do not contain secrets.
- [x] Route failure logs redact URLs/API keys but keep token pair, raw amount, recipient, stage, and sanitized error text.
- [x] Quote route and quote failure logs include server-derived request metadata when called through `/api/swap/quote`.

Minor refactor candidates:

- [x] Calldata validation helpers live in `swapValidations.ts`; path encoding/routing helpers live in `swapQuoteUtils.ts`; keep `swapQuote.ts` as orchestration only.
- [x] Add focused tests for any new router function before adding it to the allowlist.

## Phase 9: Quote Signing And Verified Swap Logging

Review `server/loaders/swapQuoteVerification.ts`, `server/loaders/swapTransactionVerification.ts`, and `server/loaders/swapLogs.ts`.

Quote signing:

- [x] Token version is current, currently `2`.
- [x] HMAC covers quote request metadata, token symbols, `amountIn`, `amountOut`, `amountOutRaw`, `minimumAmountOut`, `route`, router address, exact transaction `to/data/value`, and `deadline`.
- [x] Stable stringify sorts object keys.
- [x] Verification uses `timingSafeEqual`.
- [x] Verification token expires after the intended TTL.
- [x] Missing or malformed verification data is rejected.
- [x] HMAC signing uses a random per-process `SIGNING_SECRET` (tokens invalid after restart / across workers; same tradeoff as the in-memory replay cache).

Replay guard:

- [x] Successful verifications mark the quote token used.
- [x] Used-token cache stores a SHA-256 hash, not the raw HMAC token.
- [x] Replay is rejected before paid provider calls.
- [x] Pending, reverted, mismatched, or malformed attempts do not consume the token.
- [x] Expired used-token entries are swept opportunistically.
- [x] In-memory replay protection is acceptable for one Node instance; reconsider if multiple Node processes are introduced.

On-chain verification:

- [x] Request owner address is valid.
- [x] Transaction hash shape is valid.
- [x] Quote recipient matches owner.
- [x] Quote chain id is Polygon.
- [x] Quote router and transaction target are SwapRouter02.
- [x] Server loads transaction and receipt from its own provider.
- [x] Missing transaction/receipt is treated as not confirmed.
- [x] Receipt status must be success.
- [x] Transaction sender matches owner.
- [x] Transaction target matches router.
- [x] Transaction calldata matches signed quote exactly.
- [x] Transaction native value matches signed quote exactly.
- [x] Only after all checks pass, `transaction_event_verified` is written.
- [x] Verified log fields come from the signed quote.

Browser telemetry:

- [x] Generic `/api/swap/log` remains untrusted telemetry.
- [x] Browser cannot write a trusted `swap_confirmed` record through the generic log path.
- [x] Browser cannot spoof logged `clientIp`, request host, origin, or user agent through the swap log payload.
- [x] Server-derived swap log metadata is optional in lower-level helpers but always supplied by the API routes.
- [x] Loopback client IPs are written as `clientIp: "localhost"` for local development logs.
- [x] Browser origins are normalized to origin-only form before logging.
- [x] Log string fields are truncated and sanitized.
- [x] URLs and Alchemy key segments are redacted.
- [x] Logs are written with `JSON.stringify` to neutralize newline injection.

Minor refactor candidates:

- [x] If verified logs become product data, move from append-only logs to durable storage with unique transaction hash constraints.

## Phase 10: Frontend Quote Hook

Review `hooks/useUniswapQuote.ts`.

- [x] Fetches only when enabled, recipient exists, and amount is greater than zero.
- [x] Posts only symbol, amount, recipient, and slippage.
- [x] Uses `Content-Type: application/json`.
- [x] Clears existing quote immediately when inputs change.
- [x] Debounces requests by `SWAP_QUOTE_DEBOUNCE_MS`, currently `650`.
- [x] Aborts stale requests on input changes/unmount.
- [x] Non-JSON responses produce the backend-unavailable message rather than `Unexpected token '<'`.
- [x] Failed quote clears quote state.
- [x] Manual `refetch` increments `refreshKey`.
- [x] Manual `refetch` is gated by `SWAP_QUOTE_MANUAL_REFRESH_COOLDOWN_MS`, currently `60_000`, and no-ops while cooling down.
- [x] Manual refresh cooldown starts only for valid quote inputs: enabled, recipient present, and amount greater than zero.
- [x] Hook exposes `isRefreshCoolingDown` and `refreshCooldownSeconds` for UI state instead of duplicating timer logic in the modal.

Minor refactor candidates:

- [x] Keep this hook transport-focused. Do not move swap execution logic here.
- [x] If UI needs richer quote errors, extend typed error responses instead of parsing strings in the component.

## Phase 11: Frontend Swap Execution

Review `hooks/useUniswapSwap.ts`.

- [x] `isQuoteCurrent` checks chain id, symbols, raw amount, recipient, slippage, router address, transaction target, and expiry.
- [x] Quote expiry uses a small buffer before on-chain deadline.
- [x] Expired quote blocks approval and swap.
- [x] Balance reads use native balance for POL.
- [x] ERC-20 reads fetch both `balanceOf` and `allowance`.
- [x] Approval is exact quote amount, not unlimited.
- [x] Approval spender is SwapRouter02.
- [x] Approval is sent only when quote is current.
- [x] Swap sends backend-provided `to/data/value` unchanged.
- [x] Reverted approval or swap receipt is treated as failure.
- [x] Successful swap triggers verified transaction logging through `utils/swapTransactionLogs.ts`.
- [x] Failed approval/swap paths report sanitized telemetry.
- [x] Balance refresh happens after successful approval and swap.

Manual wallet smoke test:

- [x] Connect injected wallet.
- [x] Confirm non-Polygon wallet prompts network switch.
- [x] Enter WBTC -> PRANA amount and wait for quote.
- [x] Quote USDT -> POL and confirm native POL output works through SwapRouter02 unwrap behavior.
- [x] Change amount and confirm old quote disappears immediately.
- [x] Click Refresh once, confirm it refetches, then confirm the Refresh control is disabled with a countdown for 60 seconds.
- [x] Wait for quote expiry and confirm CTA asks to refresh.
- [x] For an ERC-20 route, confirm approval amount equals quote input amount.
- [x] Execute a small swap only if intentionally testing on mainnet.
- [x] Confirm the transaction hash opens on PolygonScan.
- [x] Confirm the server writes a verified swap log only after receipt success.
- [x] Confirm swap logs include the expected `clientIp` value; local dev should show `localhost`, production should show the real client IP after trusted proxy resolution.

Minor refactor candidates:

- [x] The hook is large but cohesive. Split only if tests or future features make it painful.
- [x] If viem type casts grow, consider local typed wrappers instead of scattering `as never`.

## Phase 12: Wallet Hook And App Wiring

Review `main.tsx`, `utils/wagmiConfig.ts`, and `hooks/useInjectedWallet.ts`.

- [x] `WagmiProvider` wraps the app.
- [x] `QueryClientProvider` wraps the app as required by wagmi.
- [x] Only Polygon is configured.
- [x] Only injected wallets are configured for V1.
- [x] `ensurePolygon()` switches to Polygon before quoting/swapping.
- [x] Disconnect behavior is clear in the modal.

Minor refactor candidates:

- [x] Keep connector list minimal unless adding explicit wallet support.
- [x] If more chains are added later, revisit every backend validator and CSP rule before adding them to wagmi.

## Phase 13: Swap Modal UI

Review `components/SwapModal.tsx` and `hero3.tsx`.

- [x] TRADE opens the modal instead of linking away.
- [x] Modal can close cleanly and resets action errors appropriately.
- [x] Default pair is WBTC -> PRANA.
- [x] Token-in and token-out cannot be the same.
- [x] Amount input handles empty, zero, and invalid values.
- [x] Slippage is fixed at V1 default unless intentionally changed.
- [x] CTA flow is Connect -> Switch network -> Approve and Swap -> Swap -> Refresh expired quote.
- [x] Manual Refresh button is disabled while loading, without a valid amount, or during the 60-second manual refresh cooldown.
- [x] Manual Refresh button displays the remaining cooldown seconds without resizing or shifting the token output row.
- [x] Expired-quote CTA does not bypass the manual refresh cooldown.
- [x] Quote loading, quote error, swap error, insufficient balance, route, min received, and gas estimate states are visible.
- [x] Successful swaps replace the form with an in-modal success view (summary, Polygonscan link, Close, Swap again) instead of an overlapping toast and a vague "Swap Complete" CTA.
- [x] Estimated gas is shown in native POL when `estimatedGasUsed` and `gasPriceWei` are available, with USD in parentheses when available.
- [x] Route rows show token path plus percent allocation, but do not expose protocol/version labels such as `V3`.
- [x] Split routes with two or more rows remain readable on mobile.
- [x] Long addresses, long route strings, and error text do not overflow on mobile.
- [x] Modal design matches existing site style without introducing nested card clutter.
- [x] Escape/click outside/focus behavior is acceptable for the current modal implementation.

Minor refactor candidates:

- [x] If the modal keeps growing, split token selector, quote summary, and action button into small components.
- [x] Keep copy terse. Do not add instructional text that duplicates obvious controls.
- [x] Preserve stable dimensions for token controls and CTA to avoid layout jumps.

## Phase 14: Recent Swap Fixes To Re-Verify

These are focused checks for recent swap quote and UI changes.

- [x] Native POL output quotes do not fail validation when AlphaRouter encodes swap output to SwapRouter02 `address(2)` before `unwrapWETH9`.
- [x] If primary-route calldata validation fails, the server writes `quote_route_failed` with `stage: "alpha_router_validation"` before returning the generic browser error.
- [x] `server/loaders/swapQuote.test.ts` includes a regression case for `exactInputSingle(... recipient = address(2))` followed by `unwrapWETH9(uint256,address)`.
- [x] Swap modal gas display prefers `~<amount> POL ($<amount>)` over USD-only display when both `estimatedGasUsed` and `gasPriceWei` are present.
- [x] Swap modal route display keeps percent allocation visible and omits protocol/version text.
- [x] Fallback PRANA routes that only have unreliable/zero quoter gas do not show a misleading POL gas amount.
- [x] Swap log request metadata is present on `quote_route_selected`, `quote_route_failed`, `transaction_event`, and `transaction_event_verified` logs.

Optional live quote smoke test, using production-like RPC env vars:

```bash
set -a; source .env; set +a
node --import tsx -e "import { loadSwapQuote } from './server/loaders/swapQuote.ts'; const q = await loadSwapQuote({ tokenInSymbol: 'USDT', tokenOutSymbol: 'POL', amountIn: '100', recipient: '0x1d791aCa381C844c4e497FCa9429dBe5D36FF1bC', slippageBps: 50 }); console.log(JSON.stringify({ amountOut: q.amountOut, route: q.route, estimatedGasUsed: q.estimatedGasUsed, gasPriceWei: q.gasPriceWei }, null, 2));"
```

Expected result: the command returns a quote, writes a `quote_route_selected` log, and includes one or more routes whose paths end in `POL`. Direct loader calls do not include request metadata unless a test supplies it; API-route calls should.

## Phase 15: Production Deployment Checks

Check these before deploying swap/server changes:

- [x] `npm run build` succeeds on the deployment Node version.
- [ ] Production service has `TRUSTED_PROXY_HOP_COUNT=2` for VPS -> Pi.
- [ ] Production swap logs show real client IPs, not only `127.0.0.1` or the immediate proxy address.
- [ ] Server/private RPC env vars are present for backend quote and verification work.
- [x] Browser CSP `connect-src` matches `FRONTEND_POLYGON_RPC_URL`.
- [x] Nginx still proxies API/static traffic to the intended port, normally `4173`.
- [x] Vite dev proxy still targets `4174` for local `dev:all`.
- [ ] Logs are writable by the service user.

## Resolved Finding Matrix

Use this to verify the later `fable-5-max-review.md` findings stayed fixed.

| Finding | Expected current status | Files/tests to check |
| --- | --- | --- |
| NEW-1: two-hop rate-limit IP selection | Fixed with `TRUSTED_PROXY_HOP_COUNT` | `server/rateLimit.ts`, `server/rateLimit.test.ts` |
| NEW-2: CSP missing frontend RPC host | Fixed with `FRONTEND_POLYGON_RPC_URL` | `constants/network.ts`, `utils/wagmiConfig.ts`, `server/securityHeaders.ts`, `server/securityHeaders.test.ts` |
| NEW-3: verify endpoint RPC amplification | Fixed with separate verify limit and replay guard | `server/rateLimit.ts`, `server/loaders/swapQuoteVerification.ts`, `server/loaders/swapTransactionVerification.ts`, tests |
| NEW-4: verified log trusted unsigned fields | Fixed by signing `amountOut` and `route` | `server/loaders/swapQuoteVerification.ts`, `server/loaders/swapTransactionVerification.test.ts` |
| NEW-5: optional hardening | Fixed: cumulative input, no deadline-less multicall, shorter deadline, UI expiry, tight img-src, global quote cap | `server/loaders/swapValidations.ts`, `constants/swapContracts.ts`, `hooks/useUniswapSwap.ts`, `server/securityHeaders.ts`, `server/rateLimit.ts`, tests |

## Review Worksheet

For each issue or refactor candidate, record:

```text
Title:
Area:
Files:
Severity: High / Medium / Low / Cleanup
Behavior today:
Expected behavior:
Evidence:
Proposed change:
Tests to add/run:
Deployment impact:
```

## Final Pass

- [ ] Re-run focused tests changed by your review.
- [ ] Re-run `npm run typecheck`.
- [ ] Re-run `npm run build`.
- [ ] Start `npm run dev:all` and perform at least API smoke tests.
- [ ] If UI changed, check desktop and mobile widths.
- [ ] Update the relevant review doc if it now describes stale behavior.
- [ ] Keep unrelated formatting churn out of the diff.
