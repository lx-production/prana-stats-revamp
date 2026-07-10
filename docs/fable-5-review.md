I've read the review doc, all five fixes in the code, and the full swap flow (backend loader, validation, routes, hooks, modal, log pipeline). Overall verdict first: the design is fundamentally sound — the wallet signs everything, the approval is for the exact quote amount rather than unlimited, and the five fixes are real and correctly implemented. But I found one important weakness that undermines fixes #3 (rate limiting) directly, plus a few smaller gaps worth knowing about.

## The five applied fixes — do they hold up?

**Fix #1, calldata validation** — solid overall. The router address, native value, recipient allowlist, function allowlist, nesting depth, and deadline checks all work as described. Two gaps:

- *Per-call input check instead of a cumulative one.* In `validateRouterCall`, each swap call inside a multicall is individually checked with `amountIn > context.amountInRaw`, but nothing checks the **sum**. A multicall with two `exactInput` calls, each spending the full input amount, would pass validation. For your own users this is mostly covered by the exact-amount approval — the second pull would fail. But SwapRouter02 is a shared contract: anyone who ever granted it an **unlimited approval** from past Uniswap use has no such backstop. Tracking cumulative input across the multicall is a cheap tightening.
- *The AlphaRouter path runs with `strictPath: false`*, so `amountOutMinimum` and the path endpoints aren't validated at all on the primary route. This only matters if the RPC/SDK feeds you bad data (which also controls the quote numbers, so it's defense-in-depth), but a relaxed check like "each call's `amountOutMinimum` must be > 0" or "the calldata's minimum must be ≥ the minimum you return in the response" would cost little.
- Very minor: the ABI includes `multicall(bytes[])` (the deadline-less variant), so a wrapper without any deadline would be accepted.

**Fix #2, staleness guard** — correct. `isQuoteCurrent` compares every field that matters, including that the recipient equals the connected wallet and the `to` address equals the known router. The known limitation in your own doc stands: the frontend never checks `deadline`, so a user can sign a quote up to 20 minutes old. The loss is bounded by `minimumAmountOut` baked into the calldata, so it's not fund-loss, but 20 minutes is generous — I'd shorten `SWAP_DEADLINE_SECONDS` to ~5 minutes and add a client-side "quote expired, refresh" check.

**Fix #3, rate limiting** — this is where the important problem is; see below.

**Fix #4, body size caps** — correct. `readJsonBody` counts bytes while streaming and throws before parsing.

**Fix #5, sanitization** — correct. The error allowlist is genuinely restrictive, and because logs are written with `JSON.stringify`, newline-based log injection is neutralized too. One small note: `sanitizeLogString` redacts the URL but keeps everything else — an attacker can still write 1000 characters of arbitrary text into your logs via the `error` field, so never treat those log fields as trusted when viewing them.

## Most important remaining issue: spoofable client IP

```40:47:server/index.ts
function getRequestIp(req: http.IncomingMessage): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.socket.remoteAddress ?? 'unknown';
}
```

This trusts the `X-Forwarded-For` header and takes the **first** entry. That header is just text the client sends — anyone can set it. Two consequences:

1. **Rate limiting is bypassable.** An attacker sends each request with a different fake `X-Forwarded-For` value and never hits the 10/min limit. This matters because every quote request triggers AlphaRouter, which fires a burst of calls to your **paid Alchemy endpoint** — so the realistic attack isn't crashing your server, it's silently burning your Alchemy quota/bill. Note that the standard nginx setup (`$proxy_add_x_forwarded_for`) *appends* the real IP after the client's spoofed values, so taking the first entry is wrong even behind a proxy — the client-controlled value comes first.
2. **Unbounded memory growth.** `swapQuoteRateLimits` / `swapLogRateLimits` entries are never deleted, only overwritten per key. Combined with spoofed unique IPs, the maps grow forever until the process is restarted.

Fixes are small: take the **last** entry of `X-Forwarded-For` (the one your own proxy appended) or only trust the header when `remoteAddress` is your proxy; and add a periodic sweep that deletes buckets older than the window (or cap the map size). A global rate limit across all IPs would also cap the worst-case Alchemy spend regardless of spoofing.

### Update: fixed in `server/rateLimit.ts`

The spoofed-IP issue is addressed. Rate limiting now lives in `server/rateLimit.ts` as `createSwapRateLimiters()`, wired from `server/index.ts` (which calls `startCleanupTimer()` once at startup) and enforced in `server/postApiRoutes.ts` on `/api/swap/quote` and `/api/swap/log`. The per-IP limits are unchanged (10 quote requests/min, 120 log requests/min), but IP key selection and stale-key cleanup were fixed:

- `X-Forwarded-For` is no longer trusted from arbitrary clients. `getRequestIp` first checks the immediate socket peer with `isTrustedProxy`. By default, only local proxy addresses are trusted: `127.0.0.1` and `::1`.
- If the app is deployed behind a non-local trusted proxy, extra trusted proxy IPs can be configured with `TRUSTED_PROXY_IPS` (comma-separated); those entries are normalized the same way as socket addresses.
- When the immediate peer is trusted and `X-Forwarded-For` is present (string or repeated header array), the server uses the **last** forwarded IP entry — the value appended by a trusted nginx hop using `$proxy_add_x_forwarded_for`.
- If the immediate peer is not trusted, the server ignores `X-Forwarded-For` and keys rate limiting on `req.socket.remoteAddress`. This prevents direct clients from choosing their own rate-limit identity.
- IPv4-mapped IPv6 socket addresses like `::ffff:127.0.0.1` are normalized before trusted-proxy checks and before being used as fallback rate-limit keys.
- A periodic cleanup timer (`startCleanupTimer`, interval 60s, `unref()`ed) sweeps both quote and log bucket maps, deleting entries whose windows have expired. This prevents stale per-IP entries from accumulating forever.

The practical result is that a spoofed header such as `X-Forwarded-For: 1.1.1.1, 2.2.2.2` no longer lets a direct client rotate fake identities. Behind the known nginx proxy, the backend keys rate limiting on the proxy-appended client IP instead of the client-controlled first value.

One remaining optional hardening layer would be a small global quote budget, separate from the per-IP budget, to cap worst-case Alchemy spend even if many real source IPs are involved. That is not required to fix the spoofed-header bug, but it is still useful cost-control for a paid upstream API.

## Other things worth knowing (lower priority)

- **No security headers on served pages.** `serveFile` and `sendJson` set no `Content-Security-Policy`, `X-Frame-Options`, or `X-Content-Type-Options`. For a page where users sign transactions, a CSP is meaningful hardening: if any XSS ever slips in, a script could swap the calldata the wallet is asked to sign. React's escaping protects you today, so this is belt-and-braces, not urgent.
- **The log endpoint accepts anything.** It's properly sanitized and size-capped, but any client (even cross-site via a `no-cors` POST, since `readJsonBody` never checks Content-Type) can write fake `swap_confirmed` events. Treat these logs as untrusted telemetry only — never as evidence a swap actually happened. If you ever want trustworthy swap records, derive them server-side from the transaction hash (look the receipt up over your own RPC) instead of trusting the browser's claim.


### Update: fixed with shared security headers

The missing-header issue is addressed with `server/securityHeaders.ts`, which defines one shared `setSecurityHeaders()` helper used by both `sendJson` / `sendText` in `server/requestHelpers.ts` and static file responses in `server/serveFile.ts`.

Every server response path now receives:

- `Content-Security-Policy` with a default same-origin policy, blocked object embeds, blocked framing via `frame-ancestors 'none'`, the existing Google-hosted `model-viewer` script allowlist, same-origin model assets, same-origin API calls, and the default public Polygon RPC used by `wagmiConfig`.
- `X-Frame-Options: DENY`, matching the CSP framing restriction for older browsers.
- `X-Content-Type-Options: nosniff`, so browsers do not reinterpret JSON, scripts, or static assets as a different content type.
- `Referrer-Policy: strict-origin-when-cross-origin`, limiting cross-origin referrer leakage while preserving useful same-origin referrers.

The helper is called before `serveFile`'s conditional request early returns, so cached `304 Not Modified` responses carry the same hardening headers as normal `200` static responses.

### Update: fixed with server-side swap confirmation verification

The generic `/api/swap/log` endpoint is now treated as untrusted telemetry only. It still accepts sanitized client events such as approvals, submitted swaps, failed swaps, and UI errors, but it no longer accepts `swap_confirmed` as a normal browser-submitted log event.

Confirmed swaps now use a separate `/api/swap/verify-transaction` endpoint. Each quote returned by `/api/swap/quote` includes a short-lived HMAC verification token over the quote metadata and exact transaction fields (`to`, `data`, and `value`). When the frontend sees a successful swap receipt, it submits the transaction hash plus the signed quote to the verification endpoint. The server then checks that:

- the quote verification token is valid and unexpired;
- the quote recipient matches the reported owner address;
- the transaction exists on Polygon and has a successful receipt;
- the transaction sender matches the owner address;
- the transaction target is the known Uniswap Swap Router 02 address;
- the on-chain calldata and native value exactly match the signed quote transaction.

Only after those checks pass does the server write a `transaction_event_verified` log with `swapEvent: "swap_confirmed"`. This means fake browser posts can still attempt to send telemetry, but they cannot create a trusted confirmed-swap record without a real successful Polygon transaction that matches a server-issued quote.

The swap JSON endpoints also now reject non-JSON bodies and cross-origin browser requests before parsing. That closes the easy `no-cors` log-spam path, while the on-chain verification handles the actual trust issue.
