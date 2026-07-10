# Server Refactor Review Guide

Use this guide to review the dependency-free server split. The intended change is structural only: preserve every route, cache header, rate limit, body cap, static-file fallback, port default, and startup behavior while making `server/index.ts` small.

## Review Goal

- Confirm `server/index.ts` is now composition only: create rate limiters, create GET/POST API handlers, run static handler, send final `404`/`500`, listen, and warm caches.
- Confirm `server/getApiRoutes.ts`, `server/postApiRoutes.ts`, `server/staticRoutes.ts`, `server/rateLimit.ts`, and `server/serverStartup.ts` preserve the behavior that used to live in `server/index.ts`.
- Confirm supporting modules (`requestHelpers.ts`, `serveFile.ts`, `cacheControl.ts`, `securityHeaders.ts`, `cacheHelpers.ts`, `projectRoot.ts`) keep response shaping and static serving consistent.
- Treat behavior changes as suspicious unless they are explicitly called out in a separate PR or note.

## File Map

| File | Review focus |
| --- | --- |
| `server/index.ts` | Entry point, handler order (GET API → POST API → static → 404), final errors, listen defaults |
| `server/types/httpTypes.ts` | Shared `RequestHandler` fallthrough contract |
| `server/getApiRoutes.ts` | Readonly GET API routes, cache headers, `summaryCache` / `pranaStatsCache` |
| `server/postApiRoutes.ts` | POST-only swap routes, body caps, rate limits, swap errors |
| `server/rateLimit.ts` | Per-IP swap limits, global quote limit, trusted proxy handling, cleanup timer |
| `server/staticRoutes.ts` | Root JSON, legacy asset, dist/public serving, SPA fallback |
| `server/serverStartup.ts` | Cache warmup list and failure logging |
| `server/requestHelpers.ts` | `sendJson`/`sendText`, body parsing, root JSON pathname helpers |
| `server/serveFile.ts` | Static file serving, ETag/`304`, in-memory cache for hashed assets |
| `server/cacheControl.ts` | Per-file `Cache-Control` rules for static and root JSON |
| `server/securityHeaders.ts` | CSP and other security headers on every response |
| `server/cacheHelpers.ts` | In-memory server-side API response cache |
| `server/projectRoot.ts` | `PROJECT_ROOT`, `DIST_DIR`, `PUBLIC_DIR` |
| `constants/cachePolicy.ts` | Central browser and server cache TTL values |

## Key Review Checks

### 1. Entry Point

- `PORT` still defaults to `4173`; `HOST` still defaults to `127.0.0.1`.
- `npm run serve:dev` and `npm run dev:all` override `PORT` to `4174`.
- Request order is GET API first, POST API second, static third, final JSON `404` last.
- Top-level errors still log `Server error:` and return `{ "error": "internal_error" }`.
- `warmApiCaches()` still runs after `server.listen(...)` and does not block accepting requests.
- `rateLimiters.startCleanupTimer()` is called exactly once during process startup.

### 2. API Routes

Readonly GET routes live in `server/getApiRoutes.ts`. POST-only swap routes live in `server/postApiRoutes.ts`.

- All existing API paths still exist:
  - `/api/summary`
  - `/api/top-holding-addresses`
  - `/api/prana-stats`
  - `/api/staking-stats`
  - `/api/capital`
  - `/api/lp-capital`
  - `/api/bond-metrics`
  - `/api/swap/quote`
  - `/api/swap/log`
  - `/api/swap/verify-transaction`
- Cache headers match the old behavior (values now come from `constants/cachePolicy.ts`):
  - Most read-only APIs: `private, max-age=30`
  - `/api/lp-capital`: `private, max-age=3600`
  - `/api/staking-stats` and `/api/bond-metrics`: `private, max-age=86400`
  - errors and swap POST successes without explicit cache options still use `no-cache`.
- `/api/summary` still returns `text/markdown; charset=utf-8`.
- `summaryCache` and `pranaStatsCache` are shared with startup warmup where needed, not recreated per request.

### 3. Swap-Specific Behavior

- `/api/swap/quote`, `/api/swap/log`, and `/api/swap/verify-transaction` are `POST` only and still return `405 method_not_allowed` for other methods.
- Body caps:
  - quote: `2048` bytes
  - log: `8192` bytes
  - verify-transaction: `32768` bytes
- Rate limits (per derived IP unless noted):
  - quote: `5` requests per minute, plus a global quote budget of `30` requests per minute across all clients
  - log: `30` requests per minute
  - verify-transaction: `10` requests per minute (independent bucket from log)
- All three swap POST endpoints reject non-JSON bodies with `415 unsupported_media_type` and cross-origin browser requests with `403 forbidden_origin`.
- `sanitizeSwapErrorMessage()` still only passes through the same small allowlist and maps `SyntaxError` to `Invalid JSON request body.`:
  - `Choose two different tokens.`
  - `Connect a valid wallet address.`
  - `Enter an amount greater than zero.`
  - `No Uniswap route found for this pair or amount.`
  - `Request body is required.`
  - `Request body is too large.`
  - `Expected application/json request body.`
  - `Cross-origin swap API requests are not allowed.`
- Log requests still go through `parseSwapTransactionLogRequest()` before `logSwapTransactionEvent()`.
- Verify requests go through `verifyAndLogSwapTransaction()` (HMAC quote token check, on-chain receipt lookup, then verified log write).

### 4. Rate Limit Trust Boundary

- Direct clients use `req.socket.remoteAddress`; they cannot choose their rate-limit key with `X-Forwarded-For`.
- `X-Forwarded-For` is trusted only when the immediate socket address is localhost (`127.0.0.1` or `::1`).
- IPv4-mapped IPv6 addresses are normalized before trusted-proxy checks and as fallback keys.
- For trusted proxy requests, the client IP is taken from `X-Forwarded-For` using `TRUSTED_PROXY_HOP_COUNT` (default `1`). With the default, that is the last entry, matching nginx `$proxy_add_x_forwarded_for` behind a single proxy.
- Bucket cleanup still removes entries older than the relevant window and the cleanup timer is `unref()`ed.

### 5. Security Headers

- `sendJson`, `sendText`, and `serveFile` all call `setSecurityHeaders()` before sending a response.
- Review that CSP `connect-src` still allows only `'self'` and the pinned frontend Polygon RPC host from `constants/network.ts`.
- Review `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.

### 6. Static And Root JSON Routing

Preserve this exact order:

1. root `data_*.json`
2. root `bonds_v2.json`
3. root `buy_dips.json`
4. `/prana-coin-fallback.png` mapped to `public/assets/icons/prana.svg`
5. `dist` files
6. `public` files
7. `dist/index.html` SPA fallback

Review that root JSON misses still return JSON `404`, while non-API SPA paths can fall back to `dist/index.html` when it exists.

Static `Cache-Control` is decided in `server/cacheControl.ts`:

- `.html`: `no-cache`
- root `data_*.json`, `bonds_v2.json`, `buy_dips.json`: short `public, max-age=30`
- hashed `dist/assets/*`, `prana-coin-fallback.png`, `prana-coin.glb`: long immutable cache
- other `.json`: `no-cache`

### 7. Startup Warmup

- Warmup still logs `Warming API caches...` and `API cache warming finished.`.
- Warmup failures still use `console.warn(...)` and do not stop the server.
- Current warmup list is preserved:
  - `/api/summary`
  - `/api/staking-stats`
  - `/api/lp-capital`
  - `/api/bond-metrics`

## Manual Smoke Tests

Run with `npm run serve` (port `4173`) or `npm run dev:all` (API on port `4174`).

```bash
# Use 4173 for npm run serve, or 4174 for npm run dev:all / serve:dev
curl -i http://127.0.0.1:4174/api/summary | head
curl -i http://127.0.0.1:4174/api/prana-stats | head
curl -i http://127.0.0.1:4174/api/staking-stats | head
curl -i http://127.0.0.1:4174/bonds_v2.json | head
curl -i http://127.0.0.1:4174/prana-coin-fallback.png | head
curl -i -X GET http://127.0.0.1:4174/api/swap/quote | head
curl -i -X GET http://127.0.0.1:4174/api/swap/verify-transaction | head
```

Expected checks:

- `/api/summary` is markdown.
- `/api/prana-stats` is JSON.
- `/api/staking-stats` has the long private cache header.
- `/bonds_v2.json` is served from the project root if present.
- `/prana-coin-fallback.png` serves SVG content.
- `GET /api/swap/quote` and `GET /api/swap/verify-transaction` return `405` JSON.

## Verification Notes

- `tsconfig.json` explicitly excludes `server/**/*.ts` and `scripts/**/*.ts`, so `npm run typecheck` is not a complete server type check.
- `npm run build` requires a Node version compatible with the installed Vite version.
- `npm run test:rate-limit` runs `server/rateLimit.test.ts` (proxy trust, per-IP limits, global quote budget, verify/log bucket isolation).
- A direct import check with `tsx` is useful for catching broken server imports after this refactor.
