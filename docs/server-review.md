# Server Refactor Review Guide

Use this guide to review the dependency-free server split. The intended change is structural only: preserve every route, cache header, rate limit, body cap, static-file fallback, port default, and startup behavior while making `server/index.ts` small.

## Review Goal

- Confirm `server/index.ts` is now composition only: create rate limiters, create API handler, run static handler, send final `404`/`500`, listen, and warm caches.
- Confirm `server/apiRoutes.ts`, `server/staticRoutes.ts`, `server/rateLimit.ts`, and `server/serverStartup.ts` preserve the behavior that used to live in `server/index.ts`.
- Treat behavior changes as suspicious unless they are explicitly called out in a separate PR or note.

## File Map

| File | Review focus |
| --- | --- |
| `server/index.ts` | Entry point, handler order, final errors, listen defaults |
| `server/types/httpTypes.ts` | Shared `RequestHandler` fallthrough contract |
| `server/apiRoutes.ts` | API routes, cache headers, swap body caps, swap errors |
| `server/rateLimit.ts` | Per-IP swap limits, trusted proxy handling, cleanup timer |
| `server/staticRoutes.ts` | Root JSON, legacy asset, dist/public serving, SPA fallback |
| `server/serverStartup.ts` | Cache warmup list and failure logging |

## Key Review Checks

### 1. Entry Point

- `PORT` still defaults to `4173`; `HOST` still defaults to `127.0.0.1`.
- Request order is API first, static second, final JSON `404` last.
- Top-level errors still log `Server error:` and return `{ "error": "internal_error" }`.
- `warmApiCaches()` still runs after `server.listen(...)` and does not block accepting requests.
- `rateLimiters.startCleanupTimer()` is called exactly once during process startup.

### 2. API Routes

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
- Cache headers match the old behavior:
  - Most read-only APIs: `private, max-age=30`
  - `/api/lp-capital`: `private, max-age=3600`
  - `/api/staking-stats` and `/api/bond-metrics`: `private, max-age=86400`
  - errors and swap POST successes without explicit cache options still use `no-cache`.
- `/api/summary` still returns `text/markdown; charset=utf-8`.
- `summaryCache` and `pranaStatsCache` are shared with startup warmup where needed, not recreated per request.

### 3. Swap-Specific Behavior

- `/api/swap/quote` and `/api/swap/log` are `POST` only and still return `405 method_not_allowed` for other methods.
- Quote body cap is still `2048` bytes; log body cap is still `8192` bytes.
- Quote rate limit is still `10` requests per minute per derived IP.
- Log rate limit is still `120` requests per minute per derived IP.
- `sanitizeSwapErrorMessage()` still only passes through the same small allowlist and maps `SyntaxError` to `Invalid JSON request body.`.
- Log requests still go through `parseSwapTransactionLogRequest()` before `logSwapTransactionEvent()`.

### 4. Rate Limit Trust Boundary

- Direct clients use `req.socket.remoteAddress`; they cannot choose their rate-limit key with `X-Forwarded-For`.
- `X-Forwarded-For` is trusted only when the immediate socket address is localhost or in `TRUSTED_PROXY_IPS`.
- IPv4-mapped IPv6 addresses are normalized before trusted-proxy checks and as fallback keys.
- For trusted proxy requests, the server uses the last forwarded IP entry, matching nginx `$proxy_add_x_forwarded_for`.
- Bucket cleanup still removes entries older than the relevant window and the cleanup timer is `unref()`ed.

### 5. Static And Root JSON Routing

Preserve this exact order:

1. root `data_*.json`
2. root `bonds_v2.json`
3. root `buy_dips.json`
4. `/prana-coin-fallback.png` mapped to `public/assets/icons/prana.svg`
5. `dist` files
6. `public` files
7. `dist/index.html` SPA fallback

Review that root JSON misses still return JSON `404`, while non-API SPA paths can fall back to `dist/index.html` when it exists.

### 6. Startup Warmup

- Warmup still logs `Warming API caches...` and `API cache warming finished.`.
- Warmup failures still use `console.warn(...)` and do not stop the server.
- Current warmup list is preserved:
  - `/api/summary`
  - `/api/staking-stats`
  - `/api/lp-capital`
  - `/api/bond-metrics`

## Manual Smoke Tests

Run with `npm run serve` or `npm run dev:all`.

```bash
curl -i http://127.0.0.1:4174/api/summary | head
curl -i http://127.0.0.1:4174/api/prana-stats | head
curl -i http://127.0.0.1:4174/api/staking-stats | head
curl -i http://127.0.0.1:4174/bonds_v2.json | head
curl -i http://127.0.0.1:4174/prana-coin-fallback.png | head
curl -i -X GET http://127.0.0.1:4174/api/swap/quote | head
```

Expected checks:

- `/api/summary` is markdown.
- `/api/prana-stats` is JSON.
- `/api/staking-stats` has the long private cache header.
- `/bonds_v2.json` is served from the project root if present.
- `/prana-coin-fallback.png` serves SVG content.
- `GET /api/swap/quote` returns `405` JSON.

## Verification Notes

- `npm run typecheck` does not currently include `server/**/*.ts`, so it is not a complete server type check.
- `npm run build` requires a Node version compatible with the installed Vite version.
- A direct import check with `tsx` is useful for catching broken server imports after this refactor.
