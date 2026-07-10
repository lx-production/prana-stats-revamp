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
| Quote backend | `server/loaders/swapQuote.ts`, `server/loaders/swapQuoteUtils.ts` |
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
node --import tsx --test server/loaders/swapQuote.test.ts
node --import tsx --test server/loaders/swapLogs.test.ts
node --import tsx --test server/loaders/swapTransactionVerification.test.ts
node --import tsx --test server/securityHeaders.test.ts
npm run typecheck
npm run build
```

- [ ] If a command fails, record whether it is a real code issue, a missing env var, a Node version issue, or a local dependency issue.
- [ ] Note that `tsconfig.json` may not fully typecheck server files if server paths are excluded. The focused `node --import tsx --test ...` commands catch server import/type mistakes better than `npm run typecheck` alone.

## Phase 2: Server Shape And Route Order

Review `server/index.ts` first. It should stay small.

- [ ] `PORT` defaults to `4173`.
- [ ] `HOST` defaults to `127.0.0.1`.
- [ ] `createSwapRateLimiters()` is called once.
- [ ] `startCleanupTimer()` is called once during startup.
- [ ] Request order is API first, static second, final JSON `404`.
- [ ] Top-level error handler logs `Server error:` and returns `{ "error": "internal_error" }`.
- [ ] `warmApiCaches()` runs after `server.listen(...)` and does not block accepting requests.

Minor refactor candidates:

- [ ] Keep `server/index.ts` composition-only. Move behavior into route/helper modules.
- [ ] Avoid adding endpoint-specific logic to `server/index.ts`.
- [ ] Consider a route table only if `server/getApiRoutes.ts` or `server/postApiRoutes.ts` grows further; do not abstract just for symmetry.

## Phase 3: Static Files, Root JSON, And Cache Headers

Review `server/staticRoutes.ts`, `server/serveFile.ts`, `server/cacheControl.ts`, and `constants/cachePolicy.ts`.

- [ ] Preserve static route order:
  1. root `data_*.json`
  2. root `bonds_v2.json`
  3. root `buy_dips.json`
  4. `/prana-coin-fallback.png` mapped to `public/assets/icons/prana.svg`
  5. `dist` files
  6. `public` files
  7. `dist/index.html` SPA fallback
- [ ] Root JSON misses return JSON `404`.
- [ ] Non-API app paths can fall back to `dist/index.html`.
- [ ] `.html` responses use `no-cache`.
- [ ] root JSON files use short public cache.
- [ ] hashed `dist/assets/*`, `prana-coin-fallback.png`, and `prana-coin.glb` use long immutable cache.
- [ ] `serveFile` sets security headers before both `200` and `304` responses.

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

- [ ] All read-only API paths still exist (in `getApiRoutes.ts`):
  - `/api/summary`
  - `/api/top-holding-addresses`
  - `/api/prana-stats`
  - `/api/staking-stats`
  - `/api/capital`
  - `/api/lp-capital`
  - `/api/bond-metrics`
- [ ] Swap POST paths still exist (in `postApiRoutes.ts`):
  - `/api/swap/quote`
  - `/api/swap/log`
  - `/api/swap/verify-transaction`
- [ ] Read-only cache headers match `docs/server-review.md`.
- [ ] `/api/summary` returns `text/markdown; charset=utf-8`.
- [ ] Swap endpoints reject non-POST methods with JSON `405`.
- [ ] Swap endpoints reject non-JSON bodies with `415 unsupported_media_type`.
- [ ] Swap endpoints reject cross-origin browser requests with `403 forbidden_origin`.
- [ ] Body caps are still:
  - quote: `2048` bytes
  - log: `8192` bytes
  - verify-transaction: `32768` bytes
- [ ] `readJsonBody()` enforces size while streaming, before JSON parse completes.
- [ ] `sanitizeSwapErrorMessage()` only exposes the intended allowlist plus `SyntaxError` mapped to `Invalid JSON request body.`
- [ ] Backend quote failures that are intentionally hidden from the browser still leave enough structured server log context to debug.
- [ ] Swap route handlers build server-only log metadata through `createSwapRequestLogMetadata()`, not from browser-submitted JSON.
- [ ] `/api/swap/quote`, `/api/swap/log`, and `/api/swap/verify-transaction` all pass request metadata into their swap log path.
- [ ] Request metadata includes derived `clientIp`, request host, origin, and user agent.

Manual boundary checks:

```bash
curl -i -X GET http://127.0.0.1:4174/api/swap/quote | head
curl -i -X GET http://127.0.0.1:4174/api/swap/verify-transaction | head
curl -i -X POST http://127.0.0.1:4174/api/swap/quote --data '{}' | head
curl -i -X POST http://127.0.0.1:4174/api/swap/quote -H 'Content-Type: text/plain' --data '{}' | head
```

Minor refactor candidates:

- [ ] Extract repeated swap endpoint guards only if it improves readability without hiding status codes.
- [ ] Consider a small helper for `method_not_allowed` responses.
- [ ] Keep sanitization local and explicit; do not pass raw server errors through to the browser.

## Phase 5: Rate Limit Trust Boundary

Review `server/rateLimit.ts` and `server/rateLimit.test.ts`.

- [ ] Direct clients use `req.socket.remoteAddress`.
- [ ] Direct clients cannot choose a bucket with `X-Forwarded-For`.
- [ ] `X-Forwarded-For` is trusted only when the immediate socket address is trusted.
- [ ] Trusted proxy addresses include localhost and `TRUSTED_PROXY_IPS`.
- [ ] IPv4-mapped IPv6 addresses are normalized.
- [ ] `getClientIp(req)` exposes the same trusted-proxy identity used by the rate-limit buckets.
- [ ] `TRUSTED_PROXY_HOP_COUNT` defaults to `1`.
- [ ] With `TRUSTED_PROXY_HOP_COUNT=2`, `"<real client>, 127.0.0.1"` resolves to the real client.
- [ ] Spoofed prepended XFF values do not shift the two-hop result.
- [ ] Per-IP quote limit is `10/min`.
- [ ] Global quote limit is `60/min`.
- [ ] Log limit is `120/min`.
- [ ] Verify limit is independent and `10/min`.
- [ ] Per-IP quote rejections do not spend the global quote budget.
- [ ] Cleanup timer sweeps quote, global quote, log, and verify buckets.
- [ ] Cleanup timer is `unref()`ed.

Deployment check:

- [ ] Confirm the production Node service sets `TRUSTED_PROXY_HOP_COUNT=2`.
- [ ] If a non-local immediate proxy reaches Node, confirm `TRUSTED_PROXY_IPS` includes that immediate proxy address.

Minor refactor candidates:

- [ ] Name rate-limit constants in a way that mirrors endpoint names.
- [ ] If future endpoints need limits, add tests before adding new buckets.
- [ ] Do not persist rate-limit buckets unless there are multiple Node instances or restart-surviving abuse becomes a real problem.

## Phase 6: Security Headers And Frontend RPC Host

Review `constants/network.ts`, `utils/wagmiConfig.ts`, and `server/securityHeaders.ts`.

- [ ] `FRONTEND_POLYGON_RPC_URL` is the single browser RPC source of truth.
- [ ] `wagmiConfig` uses `http(FRONTEND_POLYGON_RPC_URL)`, not viem's implicit default.
- [ ] CSP `connect-src` includes exactly the pinned browser RPC host plus `'self'`.
- [ ] CSP does not include stale `https://polygon-rpc.com` unless that is intentionally the pinned host.
- [ ] CSP `img-src` is tight: `'self' data:`.
- [ ] CSP includes `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, and `form-action 'self'`.
- [ ] `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin` are set on JSON, text, static files, and `304`.

Minor refactor candidates:

- [ ] Keep browser RPC config separate from server/private RPC provider config.
- [ ] If external runtime images are added later, update `img-src` with explicit hosts instead of returning to broad `https:`.

## Phase 7: Swap Types And Constants

Review `types/swap.types.ts` and `constants/swapContracts.ts`.

- [ ] Token list is Polygon mainnet only.
- [ ] PRANA, WBTC, USDC, USDT, WETH, DAI addresses and decimals match intended Polygon contracts.
- [ ] Native POL uses `kind: 'native'` and `wrappedAddress: WMATIC_ADDRESS`.
- [ ] `UNISWAP_SWAP_ROUTER_02_ADDRESS` is `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`.
- [ ] `UNISWAP_V3_QUOTER_V2_ADDRESS` matches the smart-order-router Polygon quoter used by this dependency version.
- [ ] `SWAP_DEADLINE_SECONDS` is intentionally short, currently `3 * 60`.
- [ ] `DEFAULT_SWAP_SLIPPAGE_BPS` is `50`.
- [ ] `SWAP_ROUTER_02_ABI` includes only allowed router functions.
- [ ] Deadline-less `multicall(bytes[])` is not accepted in the main decode ABI.
- [ ] Type contracts include quote request metadata and verification token fields.

Minor refactor candidates:

- [ ] If token metadata grows, consider moving token list construction to `utils/swapTokens.ts` or a dedicated token registry.
- [ ] Keep comments on Uniswap selector quirks near the ABI or calldata builder.

## Phase 8: Backend Quote Loader

Review `server/loaders/swapQuote.ts` and `server/loaders/swapQuoteUtils.ts`. This is the highest-risk file.

Primary route:

- [ ] `AlphaRouter.route()` uses the server-side provider/RPC path only.
- [ ] Alchemy/private RPC keys are never returned to the browser.
- [ ] Returned `methodParameters` exist before building a response.
- [ ] AlphaRouter errors are logged internally but exposed generically.
- [ ] AlphaRouter calldata validation failures are logged as `stage: "alpha_router_validation"` before returning the generic quote failure to the browser.

WBTC/PRANA fallback:

- [ ] Fallback is used only for intended low-liquidity PRANA cases.
- [ ] Route to/from WBTC is loaded through AlphaRouter where needed.
- [ ] Known WBTC/PRANA V3 pool fee is `10000`.
- [ ] Combined V3 path starts and ends with the requested tokens.
- [ ] QuoterV2 output is used to compute `amountOutRaw`.
- [ ] Fallback calldata uses SwapRouter02 `exactInput` without a tuple deadline.
- [ ] Fallback wraps calls in `multicall(uint256 deadline, bytes[])`.
- [ ] Native POL output path includes unwrap behavior where needed.

Validation:

- [ ] `validateSwapTransaction()` runs on every quote path before response.
- [ ] Transaction `to` is exactly SwapRouter02.
- [ ] Native `value` is correct for token-in kind.
- [ ] Allowed recipients are user wallet, router custody, or SwapRouter02 sentinel recipients `address(1)` / `address(2)`.
- [ ] Native POL output allows the expected `address(2)` temporary recipient followed by `unwrapWETH9(..., user)`.
- [ ] Router function allowlist is narrow.
- [ ] Nested multicall depth is capped.
- [ ] Empty multicalls are rejected.
- [ ] Deadline-less multicall is rejected.
- [ ] Deadline is enforced.
- [ ] V3 path endpoints are strict where expected.
- [ ] Each swap call amount is checked.
- [ ] Cumulative input across nested multicalls is checked.
- [ ] Returned `minimumAmountOut` matches or is protected by calldata min-out checks.
- [ ] Route logs do not contain secrets.
- [ ] Route failure logs redact URLs/API keys but keep token pair, raw amount, recipient, stage, and sanitized error text.
- [ ] Quote route and quote failure logs include server-derived request metadata when called through `/api/swap/quote`.

Minor refactor candidates:

- [ ] Split validation helpers into a separate `swapQuoteValidation.ts` only if the loader becomes hard to navigate.
- [ ] Keep path encoding/decoding helpers in `swapQuoteUtils.ts`.
- [ ] Add focused tests for any new router function before adding it to the allowlist.

## Phase 9: Quote Signing And Verified Swap Logging

Review `server/loaders/swapQuoteVerification.ts`, `server/loaders/swapTransactionVerification.ts`, and `server/loaders/swapLogs.ts`.

Quote signing:

- [ ] Token version is current, currently `2`.
- [ ] HMAC covers quote request metadata, token symbols, `amountIn`, `amountOut`, `amountOutRaw`, `minimumAmountOut`, `route`, router address, exact transaction `to/data/value`, and `deadline`.
- [ ] Stable stringify sorts object keys.
- [ ] Verification uses `timingSafeEqual`.
- [ ] Verification token expires after the intended TTL.
- [ ] Missing or malformed verification data is rejected.
- [ ] `SWAP_QUOTE_SIGNING_SECRET` should be configured in production. The random fallback invalidates tokens on restart and is only acceptable as a local/dev fallback.

Replay guard:

- [ ] Successful verifications mark the quote token used.
- [ ] Used-token cache stores a SHA-256 hash, not the raw HMAC token.
- [ ] Replay is rejected before paid provider calls.
- [ ] Pending, reverted, mismatched, or malformed attempts do not consume the token.
- [ ] Expired used-token entries are swept opportunistically.
- [ ] In-memory replay protection is acceptable for one Node instance; reconsider if multiple Node processes are introduced.

On-chain verification:

- [ ] Request owner address is valid.
- [ ] Transaction hash shape is valid.
- [ ] Quote recipient matches owner.
- [ ] Quote chain id is Polygon.
- [ ] Quote router and transaction target are SwapRouter02.
- [ ] Server loads transaction and receipt from its own provider.
- [ ] Missing transaction/receipt is treated as not confirmed.
- [ ] Receipt status must be success.
- [ ] Transaction sender matches owner.
- [ ] Transaction target matches router.
- [ ] Transaction calldata matches signed quote exactly.
- [ ] Transaction native value matches signed quote exactly.
- [ ] Only after all checks pass, `transaction_event_verified` is written.
- [ ] Verified log fields come from the signed quote.

Browser telemetry:

- [ ] Generic `/api/swap/log` remains untrusted telemetry.
- [ ] Browser cannot write a trusted `swap_confirmed` record through the generic log path.
- [ ] Browser cannot spoof logged `clientIp`, request host, origin, or user agent through the swap log payload.
- [ ] Server-derived swap log metadata is optional in lower-level helpers but always supplied by the API routes.
- [ ] Loopback client IPs are written as `clientIp: "localhost"` for local development logs.
- [ ] Browser origins are normalized to origin-only form before logging.
- [ ] Log string fields are truncated and sanitized.
- [ ] URLs and Alchemy key segments are redacted.
- [ ] Logs are written with `JSON.stringify` to neutralize newline injection.

Minor refactor candidates:

- [ ] Consider requiring `SWAP_QUOTE_SIGNING_SECRET` outside development mode.
- [ ] If verified logs become product data, move from append-only logs to durable storage with unique transaction hash constraints.

## Phase 10: Frontend Quote Hook

Review `hooks/useUniswapQuote.ts`.

- [ ] Fetches only when enabled, recipient exists, and amount is greater than zero.
- [ ] Posts only symbol, amount, recipient, and slippage.
- [ ] Uses `Content-Type: application/json`.
- [ ] Clears existing quote immediately when inputs change.
- [ ] Debounces requests by `SWAP_QUOTE_DEBOUNCE_MS`, currently `650`.
- [ ] Aborts stale requests on input changes/unmount.
- [ ] Non-JSON responses produce the backend-unavailable message rather than `Unexpected token '<'`.
- [ ] Failed quote clears quote state.
- [ ] Manual `refetch` increments `refreshKey`.
- [ ] Manual `refetch` is gated by `SWAP_QUOTE_MANUAL_REFRESH_COOLDOWN_MS`, currently `60_000`, and no-ops while cooling down.
- [ ] Manual refresh cooldown starts only for valid quote inputs: enabled, recipient present, and amount greater than zero.
- [ ] Hook exposes `isRefreshCoolingDown` and `refreshCooldownSeconds` for UI state instead of duplicating timer logic in the modal.

Minor refactor candidates:

- [ ] Keep this hook transport-focused. Do not move swap execution logic here.
- [ ] If UI needs richer quote errors, extend typed error responses instead of parsing strings in the component.

## Phase 11: Frontend Swap Execution

Review `hooks/useUniswapSwap.ts`.

- [ ] `isQuoteCurrent` checks chain id, symbols, raw amount, recipient, slippage, router address, transaction target, and expiry.
- [ ] Quote expiry uses a small buffer before on-chain deadline.
- [ ] Expired quote blocks approval and swap.
- [ ] Balance reads use native balance for POL.
- [ ] ERC-20 reads fetch both `balanceOf` and `allowance`.
- [ ] Approval is exact quote amount, not unlimited.
- [ ] Approval spender is SwapRouter02.
- [ ] Approval is sent only when quote is current.
- [ ] Swap sends backend-provided `to/data/value` unchanged.
- [ ] Reverted approval or swap receipt is treated as failure.
- [ ] Successful swap triggers verified transaction logging through `utils/swapTransactionLogs.ts`.
- [ ] Failed approval/swap paths report sanitized telemetry.
- [ ] Balance refresh happens after successful approval and swap.

Manual wallet smoke test:

- [ ] Connect injected wallet.
- [ ] Confirm non-Polygon wallet prompts network switch.
- [ ] Enter WBTC -> PRANA amount and wait for quote.
- [ ] Quote USDT -> POL and confirm native POL output works through SwapRouter02 unwrap behavior.
- [ ] Change amount and confirm old quote disappears immediately.
- [ ] Click Refresh once, confirm it refetches, then confirm the Refresh control is disabled with a countdown for 60 seconds.
- [ ] Wait for quote expiry and confirm CTA asks to refresh.
- [ ] For an ERC-20 route, confirm approval amount equals quote input amount.
- [ ] Execute a small swap only if intentionally testing on mainnet.
- [ ] Confirm the transaction hash opens on PolygonScan.
- [ ] Confirm the server writes a verified swap log only after receipt success.
- [ ] Confirm swap logs include the expected `clientIp` value; local dev should show `localhost`, production should show the real client IP after trusted proxy resolution.

Minor refactor candidates:

- [ ] The hook is large but cohesive. Split only if tests or future features make it painful.
- [ ] If viem type casts grow, consider local typed wrappers instead of scattering `as never`.

## Phase 12: Wallet Hook And App Wiring

Review `main.tsx`, `utils/wagmiConfig.ts`, and `hooks/useInjectedWallet.ts`.

- [ ] `WagmiProvider` wraps the app.
- [ ] `QueryClientProvider` wraps the app as required by wagmi.
- [ ] Only Polygon is configured.
- [ ] Only injected wallets are configured for V1.
- [ ] `ensurePolygon()` switches to Polygon before quoting/swapping.
- [ ] Disconnect behavior is clear in the modal.

Minor refactor candidates:

- [ ] Keep connector list minimal unless adding explicit wallet support.
- [ ] If more chains are added later, revisit every backend validator and CSP rule before adding them to wagmi.

## Phase 13: Swap Modal UI

Review `components/SwapModal.tsx` and `hero3.tsx`.

- [ ] TRADE opens the modal instead of linking away.
- [ ] Modal can close cleanly and resets action errors appropriately.
- [ ] Default pair is WBTC -> PRANA.
- [ ] Token-in and token-out cannot be the same.
- [ ] Amount input handles empty, zero, and invalid values.
- [ ] Slippage is fixed at V1 default unless intentionally changed.
- [ ] CTA flow is Connect -> Switch network -> Approve and Swap -> Swap -> Refresh expired quote.
- [ ] Manual Refresh button is disabled while loading, without a valid amount, or during the 60-second manual refresh cooldown.
- [ ] Manual Refresh button displays the remaining cooldown seconds without resizing or shifting the token output row.
- [ ] Expired-quote CTA does not bypass the manual refresh cooldown.
- [ ] Quote loading, quote error, swap error, insufficient balance, route, min received, and gas estimate states are visible.
- [ ] Estimated gas is shown in native POL when `estimatedGasUsed` and `gasPriceWei` are available, with USD in parentheses when available.
- [ ] Route rows show token path plus percent allocation, but do not expose protocol/version labels such as `V3`.
- [ ] Split routes with two or more rows remain readable on mobile.
- [ ] Long addresses, long route strings, and error text do not overflow on mobile.
- [ ] Modal design matches existing site style without introducing nested card clutter.
- [ ] Escape/click outside/focus behavior is acceptable for the current modal implementation.

Minor refactor candidates:

- [ ] If the modal keeps growing, split token selector, quote summary, and action button into small components.
- [ ] Keep copy terse. Do not add instructional text that duplicates obvious controls.
- [ ] Preserve stable dimensions for token controls and CTA to avoid layout jumps.

## Phase 14: Recent Swap Fixes To Re-Verify

These are focused checks for recent swap quote and UI changes.

- [ ] Native POL output quotes do not fail validation when AlphaRouter encodes swap output to SwapRouter02 `address(2)` before `unwrapWETH9`.
- [ ] If primary-route calldata validation fails, the server writes `quote_route_failed` with `stage: "alpha_router_validation"` before returning the generic browser error.
- [ ] `server/loaders/swapQuote.test.ts` includes a regression case for `exactInputSingle(... recipient = address(2))` followed by `unwrapWETH9(uint256,address)`.
- [ ] Swap modal gas display prefers `~<amount> POL ($<amount>)` over USD-only display when both `estimatedGasUsed` and `gasPriceWei` are present.
- [ ] Swap modal route display keeps percent allocation visible and omits protocol/version text.
- [ ] Fallback PRANA routes that only have unreliable/zero quoter gas do not show a misleading POL gas amount.
- [ ] Swap log request metadata is present on `quote_route_selected`, `quote_route_failed`, `transaction_event`, and `transaction_event_verified` logs.

Optional live quote smoke test, using production-like RPC env vars:

```bash
set -a; source .env; set +a
node --import tsx -e "import { loadSwapQuote } from './server/loaders/swapQuote.ts'; const q = await loadSwapQuote({ tokenInSymbol: 'USDT', tokenOutSymbol: 'POL', amountIn: '100', recipient: '0x1d791aCa381C844c4e497FCa9429dBe5D36FF1bC', slippageBps: 50 }); console.log(JSON.stringify({ amountOut: q.amountOut, route: q.route, estimatedGasUsed: q.estimatedGasUsed, gasPriceWei: q.gasPriceWei }, null, 2));"
```

Expected result: the command returns a quote, writes a `quote_route_selected` log, and includes one or more routes whose paths end in `POL`. Direct loader calls do not include request metadata unless a test supplies it; API-route calls should.

## Phase 15: Production Deployment Checks

Check these before deploying swap/server changes:

- [ ] `npm run build` succeeds on the deployment Node version.
- [ ] Production service has `SWAP_QUOTE_SIGNING_SECRET` set.
- [ ] Production service has `TRUSTED_PROXY_HOP_COUNT=2` for VPS -> Pi.
- [ ] Production service has any needed `TRUSTED_PROXY_IPS` if the immediate proxy is not localhost.
- [ ] Production swap logs show real client IPs, not only `127.0.0.1` or the immediate proxy address.
- [ ] Server/private RPC env vars are present for backend quote and verification work.
- [ ] Browser CSP `connect-src` matches `FRONTEND_POLYGON_RPC_URL`.
- [ ] Nginx still proxies API/static traffic to the intended port, normally `4173`.
- [ ] Vite dev proxy still targets `4174` for local `dev:all`.
- [ ] Logs are writable by the service user.

## Resolved Finding Matrix

Use this to verify the later `fable-5-max-review.md` findings stayed fixed.

| Finding | Expected current status | Files/tests to check |
| --- | --- | --- |
| NEW-1: two-hop rate-limit IP selection | Fixed with `TRUSTED_PROXY_HOP_COUNT` | `server/rateLimit.ts`, `server/rateLimit.test.ts` |
| NEW-2: CSP missing frontend RPC host | Fixed with `FRONTEND_POLYGON_RPC_URL` | `constants/network.ts`, `utils/wagmiConfig.ts`, `server/securityHeaders.ts`, `server/securityHeaders.test.ts` |
| NEW-3: verify endpoint RPC amplification | Fixed with separate verify limit and replay guard | `server/rateLimit.ts`, `server/loaders/swapQuoteVerification.ts`, `server/loaders/swapTransactionVerification.ts`, tests |
| NEW-4: verified log trusted unsigned fields | Fixed by signing `amountOut` and `route` | `server/loaders/swapQuoteVerification.ts`, `server/loaders/swapTransactionVerification.test.ts` |
| NEW-5: optional hardening | Fixed: cumulative input, no deadline-less multicall, shorter deadline, UI expiry, tight img-src, global quote cap | `server/loaders/swapQuote.ts`, `constants/swapContracts.ts`, `hooks/useUniswapSwap.ts`, `server/securityHeaders.ts`, `server/rateLimit.ts`, tests |

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
