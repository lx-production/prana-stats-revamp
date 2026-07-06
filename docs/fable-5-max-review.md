# Fable 5 Max — Final Security Review (Polygon Swap)

This is the third and final security pass over the in-app Polygon swap feature. It sits
alongside the two earlier documents and does not repeat their full contents:

- [swap-ui-review.md](./swap-ui-review.md) — architecture and the original five hardening fixes.
- [fable-5-review.md](./fable-5-review.md) — deeper review that found and fixed the spoofable-IP
  issue, added security headers, and added server-side swap confirmation.

Here I do two things: (1) re-verify that the previously known issues and their fixes still hold
in the code as it stands today, and (2) look for **new** problems that the earlier passes missed.
I found two that matter (one breaks the swap in production, one silently defeats the rate limiter
in the real deployment) plus a few smaller ones.

---

## Overall verdict

The core trust model is still sound: the user's wallet signs every approval and swap, approvals
are for the exact quote amount (not unlimited), the backend re-decodes and validates all router
calldata before returning it, and confirmed-swap logs are verified on-chain instead of trusted
from the browser. Nothing here lets an attacker move a user's funds.

**But two new findings undermine work the earlier reviews thought was finished:**

1. The per-IP rate limiter (fix #3) collapses to a **single shared bucket** in the real
   two-hop VPS→Pi deployment, because the "use the last `X-Forwarded-For` entry" logic assumes
   exactly one trusted proxy, and there are two.
2. The Content-Security-Policy added in the follow-up pass **does not list the RPC host the
   frontend actually uses** (`polygon.drpc.org`), so in production the swap modal cannot read
   balances/allowances or wait for receipts. It "works on my machine" only because the Vite dev
   server never sends the CSP.

Both are explained in detail in Part 2, with fixes.

---

## Part 1 — Do the known issues and their fixes still hold?

Short answer: yes, every previously applied fix is still present and correctly wired. Quick
confirmation of each, so this document stands on its own.

**Fix #1 — backend calldata validation (`server/loaders/swapQuote.ts`).** Still runs on both the
AlphaRouter path and the PRANA fallback path before any quote is returned. `validateSwapTransaction`
checks the router `to` address and native `value`, then `validateRouterCall` walks nested
`multicall` batches (depth capped at 4), enforces the deadline on the `multicall(uint256,bytes[])`
variant, and only allows the whitelisted router functions. The recipient allowlist (user wallet or
router custody) and the amount checks are intact. The known softness on the AlphaRouter path
(`strictPath: false`) is unchanged — see NEW-5 below for what remains open there.

**Fix #2 — quote staleness guard (`hooks/useUniswapSwap.ts`).** `isQuoteCurrent` still compares
chain id, both token symbols, `amountInRaw`, recipient, slippage, and both router addresses before
approve or swap. `useUniswapQuote` still clears the previous quote the moment inputs change. The
still-open limitation from the earlier doc (the frontend never checks the quote `deadline` age) is
unchanged.

**Fix #3 — rate limiting (`server/rateLimit.ts`).** Present and wired through `server/apiRoutes.ts`
for `/api/swap/quote` (10/min), `/api/swap/log` and `/api/swap/verify-transaction` (120/min). The
spoofing fix from fable-5-review is here (only trust `X-Forwarded-For` when the socket peer is a
trusted proxy; otherwise key on the socket address; sweep stale buckets on a timer). **However,
the IP-selection logic is wrong for this specific deployment — see NEW-1.**

**Fix #4 — body size caps (`server/requestHelpers.ts`).** `readJsonBody` still counts bytes while
streaming and throws before parsing. Quote 2 KB, log 8 KB, verify 32 KB.

**Fix #5 — error/log sanitization (`server/apiRoutes.ts`, `server/loaders/swapLogs.ts`).** The
user-facing error allowlist is intact, and `sanitizeLogString` still redacts URLs and Alchemy key
segments and truncates. Logs are written with `JSON.stringify`, so newline log-injection is still
neutralized.

**Follow-up fixes still in place:** shared security headers via `server/securityHeaders.ts` (but
see NEW-2 for a policy gap), on-chain swap confirmation via
`server/loaders/swapTransactionVerification.ts` (but see NEW-4 for a coverage gap), and the
`415`/`403` request hardening (JSON-only, same-origin) in `server/apiRoutes.ts`.

---

## Part 2 — New findings

### NEW-1 — [High] The rate limiter becomes one global bucket in the real deployment

This is the important one, because it silently defeats fix #3 in production while looking correct
in the code.

The IP-selection logic assumes there is exactly **one** trusted proxy in front of the Node server,
so it takes the **last** entry of `X-Forwarded-For`:

```37:52:server/rateLimit.ts
function getRequestIp(req: IncomingMessage, trustedProxyAddresses: Set<string>): string {
  const socketAddress = req.socket.remoteAddress ?? 'unknown';
  const forwardedFor = req.headers['x-forwarded-for'];

  if (isTrustedProxy(socketAddress, trustedProxyAddresses) && forwardedFor) {
    const forwardedHeader = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
    const forwardedIps = forwardedHeader.split(',').map((ip) => ip.trim()).filter(Boolean);
    const proxyAppendedIp = forwardedIps[forwardedIps.length - 1];

    if (proxyAppendedIp) {
      return proxyAppendedIp;
    }
  }

  return normalizeSocketAddress(socketAddress);
}
```

But the documented production topology (`md/NETWORK_ARCHITECTURE.md`) has **two** nginx hops, each
of which appends to `X-Forwarded-For` with `$proxy_add_x_forwarded_for`:

- User → **VPS nginx** (appends the real client IP) → reverse SSH tunnel → **Pi nginx** (appends
  `127.0.0.1`, because the tunnel makes the connection look local) → Node.

So by the time the header reaches Node it looks like `"<real client IP>, 127.0.0.1"`, and the
**last** entry is always `127.0.0.1` — the value the Pi's nginx appended, not the client. I
reproduced the exact `getRequestIp` logic against this topology to be sure:

```text
attacker sends nothing:        127.0.0.1
attacker spoofs XFF=1.1.1.1:    127.0.0.1
a different real user:          127.0.0.1
```

Every request, from everyone, is keyed to `127.0.0.1`.

**Why this matters:**

- **Legitimate users get blocked far too easily.** All visitors now share one bucket, so the whole
  site is limited to 10 quote requests per minute *combined*. Because a quote is refetched on a
  650 ms debounce every time the amount changes, a single person adjusting an amount a handful of
  times can trip the global limit and then everyone (including themselves) gets `429` for the rest
  of the minute.
- **Trivial denial of service.** Any one client can intentionally send 10 quote requests and lock
  the quote endpoint for the entire site for up to a minute. No spoofing needed.
- The spoofing protection from fable-5-review still works (a direct client can't choose its key),
  but the correct client IP is being thrown away, so per-IP fairness is gone.

**Fix.** The number of *trusted* proxies that append to the header is fixed and known (2: the VPS
and the Pi). The real client is therefore always the entry that many positions from the end. Make
the hop count configurable and select from the right, defaulting to the current behavior so a
single-proxy dev setup still works:

```ts
const TRUSTED_PROXY_HOP_COUNT = Number(process.env.TRUSTED_PROXY_HOP_COUNT ?? 1);

// ...inside getRequestIp, when the socket peer is trusted:
const index = forwardedIps.length - TRUSTED_PROXY_HOP_COUNT;
const clientIp = index >= 0 ? forwardedIps[index] : forwardedIps[0];
if (clientIp) return clientIp;
```

With `TRUSTED_PROXY_HOP_COUNT=2` in production, `"evil, <real client>, 127.0.0.1"` correctly
resolves to `<real client>` (attacker-prepended junk shifts everything left but the offset from the
end is unchanged, so it can't be gamed).

Deployment note: the repo-contained fix depends on the production Node service setting
`TRUSTED_PROXY_HOP_COUNT=2` for the documented VPS nginx → Pi nginx chain. Leaving it unset keeps
the single-proxy default for local/dev setups.

Alternative (infra-only) fix: stop overwriting a dedicated header at the second hop. On the VPS you
already set `X-Real-IP $remote_addr`; on the Pi, change it to pass the value through
(`proxy_set_header X-Real-IP $http_x_real_ip;`) and have Node read `x-real-ip` when the peer is
trusted. Either approach works; the code approach keeps the fix inside the repo.

---

### NEW-2 — [High / functional-security] The CSP blocks the RPC host the frontend actually uses

The follow-up pass added a Content-Security-Policy and both prior docs describe its `connect-src`
as including "the default public Polygon RPC used by `wagmiConfig`". That assumption is now stale,
and the result is that the CSP blocks the swap modal's own network calls in production.

The policy allows only same-origin plus `polygon-rpc.com` for outbound connections:

```3:15:server/securityHeaders.ts
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' https://ajax.googleapis.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://polygon-rpc.com",
  "model-src 'self'",
  "form-action 'self'",
].join('; ');
```

But the wagmi config uses `http()` with **no URL**, which means viem falls back to the chain's
default RPC:

```5:11:utils/wagmiConfig.ts
export const wagmiConfig = createConfig({
  chains: [polygon],
  connectors: [injected()],
  transports: {
    [polygon.id]: http(),
  },
});
```

In the installed viem, the Polygon chain's default RPC is **not** `polygon-rpc.com` anymore:

```text
viem polygon default http RPC: [ 'https://polygon.drpc.org' ]
```

The swap modal relies on this transport for real reads — `refreshBalances` reads `balanceOf` and
`allowance`, and after a swap it calls `waitForTransactionReceipt` — all through the wagmi
`publicClient`, i.e. `https://polygon.drpc.org`. Because that host is absent from `connect-src`,
the browser blocks those requests once the CSP is enforced. Concretely, in production the "From"
balance never loads (stuck on `...`) and a successful on-chain swap can still surface as an error
because the receipt poll is blocked.

This passes local testing only because in dev the app is served by **Vite** (port 5173), which
doesn't send the CSP; the header is added by the Node server, which is what actually serves the
built site in production. Classic works-in-dev, breaks-in-prod.

**Fix (pick one, ideally both):**

1. Add the real host to the policy: `connect-src 'self' https://polygon.drpc.org` (keep
   `polygon-rpc.com` too if you like as a fallback).
2. Stop depending on viem's silently-changing default — pin the transport to an explicit RPC URL
   and make the CSP match it, so a future viem bump can't quietly break this again:

```ts
transports: {
  [polygon.id]: http('https://polygon-rpc.com'),
},
```

   then `connect-src 'self' https://polygon-rpc.com` is correct by construction. Whichever host you
   choose for the frontend transport, the `connect-src` entry must equal it.

---

### NEW-3 — [Medium-low] `verify-transaction` amplifies one quote token into many paid RPC calls

The confirmation endpoint is good for its purpose (it stops fake browser `swap_confirmed` posts),
but it's a cheap way to make the server do paid upstream work.

- It shares the 120/min "log" limiter (`rateLimiters.isSwapLogRateLimited` in
  `server/apiRoutes.ts`), and each accepted call performs **two** RPC lookups against the server's
  Alchemy provider (`getTransaction` + `getTransactionReceipt` in
  `server/loaders/swapTransactionVerification.ts`).
- The gate to reach that RPC work is a valid HMAC quote token — but a token is valid for **30
  minutes** (`QUOTE_VERIFICATION_TTL_SECONDS`) and has no nonce or single-use marker, so the same
  token can be replayed to drive up to 120 verifications/min (≈240 RPC calls/min) for its whole
  lifetime, from a single obtained quote.

Impact is cost/quota amplification on your paid RPC, not fund loss. It's lower priority than
NEW-1/NEW-2 but worth tightening once those are done: give the verification endpoint its own,
smaller rate limit (it should be called roughly once per real swap), and/or bind a token to a
single successful verification (e.g. remember verified quote-token hashes for the TTL and reject
repeats).

---

### NEW-4 — [Low] The "verified" swap log trusts unsigned fields

The on-chain verification proves the important things (a real, successful Polygon tx from the owner
to the router, with calldata and value matching the signed quote). But the HMAC token only covers a
subset of the quote, and the log then reads fields that are **outside** that subset.

The signed payload is built here:

```29:45:server/loaders/swapQuoteVerification.ts
function normalizeQuoteForSigning(quote: SignableSwapQuote): Record<string, unknown> {
  return {
    request: quote.request,
    tokenInSymbol: quote.tokenIn.symbol,
    tokenOutSymbol: quote.tokenOut.symbol,
    amountIn: quote.amountIn,
    amountOutRaw: quote.amountOutRaw,
    minimumAmountOut: quote.minimumAmountOut,
    routerAddress: quote.routerAddress.toLowerCase(),
    transaction: {
      to: quote.transaction.to.toLowerCase(),
      data: quote.transaction.data.toLowerCase(),
      value: quote.transaction.value,
    },
    deadline: quote.deadline,
  };
}
```

Notice `amountOut` (the human-readable output), `route`, and the gas fields are **not** signed.
Yet `verifyAndLogSwapTransaction` writes `amountOut` and `route` straight from the client-submitted
quote into the `transaction_event_verified` record. So a caller who owns a real matching swap can
still write a `swap_confirmed` log with a **falsified** output amount or route, because those
fields aren't part of what the signature protects and aren't cross-checked on-chain.

This is log integrity only (no funds, no state), which is why it's Low. If you want the verified log
to be fully trustworthy, either add `amountOut`/`route` to `normalizeQuoteForSigning` (so tampering
invalidates the token) or derive the logged output amount from the on-chain receipt instead of the
submitted quote.

---

### NEW-5 — [Low / defense-in-depth] Smaller items and carry-overs

These are minor or already acknowledged in the earlier docs; grouped here so the final picture is
complete.

- **Cumulative input isn't summed on the AlphaRouter path.** In `validateRouterCall`, each swap call
  in a multicall is checked individually against the input amount, not as a running total:

```113:115:server/loaders/swapQuote.ts
    } else if (amountIn > context.amountInRaw) {
      throw new Error('Uniswap returned calldata with too much input.');
    }
```

  For your own users the exact-amount approval is the backstop. The residual risk is only for
  someone who previously gave SwapRouter02 an unlimited allowance elsewhere, and only if the SDK/RPC
  is compromised. Tracking a cumulative sum across the multicall would close it cheaply. (Raised in
  fable-5-review; still open.)

- **No client-side deadline-age check.** The backend bakes a 20-minute deadline into the calldata,
  but `isQuoteCurrent` doesn't reject an old-but-unchanged quote, so a user could sign a quote up to
  ~20 minutes stale. `minimumAmountOut` bounds the loss, so this isn't fund-loss; shortening
  `SWAP_DEADLINE_SECONDS` to ~5 minutes and adding a "quote expired, refresh" check is the tidy fix.
  (Raised before; still open.)

- **`img-src 'self' data: https:` is broad.** It permits images from any HTTPS origin, which is a
  mild data-exfil channel if an injection ever occurred. Tightening to the specific hosts you use is
  optional hardening.

- **The deadline-less `multicall(bytes[])` is still accepted.** The ABI in
  `constants/swapContracts.ts` includes both multicall variants, so a wrapper carrying no on-chain
  deadline would pass validation. Low impact (min-out still protects value), but you could drop the
  deadline-less variant from the decode ABI since your own fallback always uses the deadline form.

- **A single global quote budget is still worth adding.** Independent of NEW-1, a small
  all-IPs-combined cap on `/api/swap/quote` would bound worst-case Alchemy spend even when many
  distinct real IPs are involved.

---

## Part 3 — Prioritized action list

1. **Fix the rate-limiter IP selection for the two-hop deployment (NEW-1).** Without this, fix #3
   is effectively off in production and one client can `429` the whole site. Make the trusted-hop
   count configurable (or preserve `X-Real-IP` across the Pi hop).
2. **Fix the CSP `connect-src` to include the real RPC host, and pin the frontend transport
   (NEW-2).** Without this the swap modal can't read balances or confirm receipts in production.
3. **Give `/api/swap/verify-transaction` its own tighter limit and/or make quote tokens
   single-use (NEW-3).** Caps paid-RPC amplification.
4. **Sign `amountOut`/`route` or log them from the receipt (NEW-4).** Makes the verified-swap log
   trustworthy end to end.
5. **Optional hardening (NEW-5):** cumulative multicall input, shorter deadline + expiry UI, tighter
   `img-src`, drop the deadline-less multicall variant, add a global quote budget.

None of these are fund-loss bugs. Items 1 and 2 are the ones I'd fix before the next production
deploy, because each breaks a security/robustness guarantee that the earlier reviews recorded as
"done" — and both are invisible in local dev.

---

## Refactor note — NEW-1 implementation

The NEW-1 fix is a small behavior refactor in `server/rateLimit.ts`, not a change to the rate-limit
budgets themselves. The limiter still creates one bucket per derived client identity, still allows
10 quote requests per minute and 120 log/verify requests per minute, and still ignores
`X-Forwarded-For` unless the immediate socket peer is trusted. What changed is only how the trusted
proxy chain is interpreted after that trust check passes.

Previously, trusted proxy traffic always used the last `X-Forwarded-For` entry. That was correct for
a single nginx hop, but wrong for production because the documented path has two appending proxies:
VPS nginx appends the real client IP, then Pi nginx appends the tunnel-local peer (`127.0.0.1`).
Taking the last entry therefore keyed everyone to the Pi hop. The refactor adds
`TRUSTED_PROXY_HOP_COUNT`, defaulting to `1`, and selects the entry that many positions from the
right side of the header. In production, `TRUSTED_PROXY_HOP_COUNT=2` makes
`"<real client>, 127.0.0.1"` resolve to `<real client>`; if a caller prepends spoofed values, the
right-side offset still lands on the proxy-appended real client entry.

Operationally, this means local and one-proxy setups keep the old default behavior with no env
change, while the two-hop VPS → Pi deployment must set `TRUSTED_PROXY_HOP_COUNT=2` in the Node
service environment before restart. The regression test for this lives in `server/rateLimit.test.ts`
and can be run with `npm run test:rate-limit`.

---

## Refactor note — NEW-2 implementation

The NEW-2 fix pins the browser-side Polygon RPC host and makes the production CSP match that exact
host. The frontend no longer depends on viem's chain default for Polygon, so a future viem/wagmi
upgrade cannot silently move browser RPC traffic to a different origin that the CSP does not allow.

The shared source of truth is `FRONTEND_POLYGON_RPC_URL` in `constants/network.ts`, currently set to
`https://polygon.drpc.org`. `utils/wagmiConfig.ts` now passes that value to `http(...)` for the
Polygon transport instead of calling `http()` with no URL. `server/securityHeaders.ts` imports the
same constant and builds `connect-src 'self' https://polygon.drpc.org`, replacing the stale
`https://polygon-rpc.com` entry that did not match the actual frontend RPC traffic.

This refactor intentionally does not change server-side paid/private RPC configuration. The backend
quote, verification, and data-loading code can continue to use its existing environment-driven RPC
provider selection; the new constant is only for browser-originated wagmi reads and receipt polling.

The regression test for this lives in `server/securityHeaders.test.ts`. It asserts that the CSP
`connect-src` includes the pinned `https://polygon.drpc.org` host and does not include the stale
`https://polygon-rpc.com` host. The focused test can be run with
`node --import tsx --test server/securityHeaders.test.ts`; the implementation was also verified
with `npm run typecheck` and `npm run build`.

---

## Refactor note — NEW-3 implementation

The NEW-3 fix now caps swap verification amplification in two layers: a dedicated verify endpoint
rate limit and a successful-verification replay guard for signed quote tokens. This is still
cost/quota hardening only; it does not change the swap trust model or the browser request/response
shape.

First, `/api/swap/verify-transaction` no longer shares the broad 120/min swap-log bucket. The
rate limiter in `server/rateLimit.ts` now has a separate `SWAP_VERIFY_RATE_LIMIT` of 10 requests
per minute per derived client IP, with its own bucket map and cleanup sweep. `server/apiRoutes.ts`
uses `isSwapVerifyRateLimited(req)` for only the verification endpoint, while `/api/swap/log`
continues to use the existing 120/min budget. Quote and log budgets are otherwise unchanged, and
the verify limiter uses the same trusted-proxy client-IP derivation fixed in NEW-1.

Second, `server/loaders/swapQuoteVerification.ts` now remembers quote verification tokens that have
already produced a successful verified swap log. The cache stores a SHA-256 hash of the token, not
the raw HMAC token, and each entry expires at the quote token's own `verification.expiresAt`
timestamp. Cleanup is opportunistic: each replay check or mark operation sweeps expired entries, so
the in-memory map stays bounded without a new timer.

The ordering is important. `verifyAndLogSwapTransaction` still validates the HMAC quote token and
quote shape first, then checks whether the token was already used **before** loading the server
provider or making `getTransaction` / `getTransactionReceipt` RPC calls. If the token is a replay,
the request fails locally and does not spend paid RPC quota. The token is marked used only after
all on-chain checks pass and the `transaction_event_verified` log is written. Pending receipts,
malformed requests, reverted transactions, mismatched calldata/value, and failed log writes do not
consume the quote token, so a legitimate delayed confirmation can still be retried later.

This is intentionally an in-memory guard. Restarting the Node process clears the used-token cache,
which is acceptable for this finding because the goal is to reduce routine paid-RPC amplification
during the 30-minute quote-token lifetime, not to create durable swap state. A persistent store
would only be necessary if replay suppression had to survive process restarts or multiple Node
instances.

Regression coverage was added in two places:

- `server/rateLimit.test.ts` checks that verification has an independent 10/min bucket, spending
  log budget does not spend verify budget, and the verify limiter follows the same trusted-proxy
  identity logic as quote/log limiting.
- `server/loaders/swapTransactionVerification.test.ts` checks that successful verification marks a
  token used, replay is rejected before provider/RPC calls, pending verification attempts do not
  consume the token, and expired replay entries are swept.

The focused tests can be run with `npm run test:rate-limit` and
`node --import tsx --test server/loaders/swapTransactionVerification.test.ts`; the implementation
was also verified with `npm run typecheck` and `npm run build`.

---

## Refactor note — NEW-4 implementation

The NEW-4 fix makes the verified swap log's display fields part of the same server-issued HMAC
quote token that already protects the executable swap details. `server/loaders/swapQuoteVerification.ts`
now signs `amountOut` and `route` in addition to `amountOutRaw`, `minimumAmountOut`, router address,
deadline, and calldata. Because `verifyAndLogSwapTransaction` validates that token before loading
the provider or writing `transaction_event_verified`, a caller can no longer take a real matching
swap and submit a falsified human-readable output amount or route for the verified log.

The quote verification token version was bumped from `1` to `2`. That intentionally makes any
already-issued v1 quote tokens invalid after deploy; the practical impact is only that an in-flight
quote may need to refresh, and quote tokens already expire after 30 minutes.

This chose the "sign the fields" path rather than deriving route/output from the receipt. Receipt
decoding would require reconstructing multi-hop token transfer behavior across V2/V3 paths, while
the server already knows the expected route and output at quote time. Signing those fields keeps
the fix small and aligned with the existing quote trust model.

Regression coverage in `server/loaders/swapTransactionVerification.test.ts` now checks that
tampering with either `amountOut` or `route` rejects the verification before any provider/RPC calls
and does not consume the quote token. The focused test can be run with
`node --import tsx --test server/loaders/swapTransactionVerification.test.ts`; the implementation
was also verified with `npm run typecheck` and `npm run build`.

---

## Refactor note — NEW-5 implementation

The NEW-5 optional hardening items are now implemented across the swap validator, quote UI, CSP,
and quote rate limiter.

`server/loaders/swapQuote.ts` now tracks a cumulative input budget while recursively validating
router calldata. Each input-consuming swap call (`exactInput`, `exactInputSingle`, and
`swapExactTokensForTokens`) still has its individual amount checked, but it also spends from a
shared `context.amountInRaw` budget across nested multicalls. This keeps legitimate split
AlphaRouter routes working when their total input is within the quote amount, while rejecting a
multicall whose individual calls each look acceptable but whose combined input exceeds the quoted
input.

The deadline-less `multicall(bytes[])` variant was removed from `SWAP_ROUTER_02_ABI` in
`constants/swapContracts.ts`. Since both the AlphaRouter calls and the WBTC/PRANA fallback are
requested/encoded with `multicall(uint256 deadline,bytes[])`, the validator now rejects wrappers
that do not carry the expected on-chain deadline instead of accepting them as another allowed router
shape.

The backend deadline was already shortened to `SWAP_DEADLINE_SECONDS = 3 * 60`. The frontend now
also enforces quote age in `hooks/useUniswapSwap.ts`: a quote is considered expired five seconds
before its on-chain deadline, `isQuoteCurrent` returns false for expired quotes, approval/swap is
blocked, and `components/SwapModal.tsx` lets the primary button refresh the expired quote with the
visible message `Quote expired. Refresh to continue.`

`server/securityHeaders.ts` now tightens image loading from `img-src 'self' data: https:` to
`img-src 'self' data:`. The page's runtime image assets are local (`public/assets/...`), while the
absolute Open Graph/Twitter image URLs in `index.html` are for crawlers and are not runtime page
loads governed by this CSP.

`server/rateLimit.ts` now adds a global quote budget on top of the existing per-IP quote budget:
`/api/swap/quote` still allows 10 requests per minute per derived client IP, but all clients
combined are capped at 60 accepted quote requests per minute. Per-IP rejections return before
spending the global bucket, so a single noisy IP does not consume the shared budget after it has
already exhausted its own.

Regression coverage was added in three places:

- `server/loaders/swapQuote.test.ts` checks that split input within budget passes, cumulative input
  above budget fails, and the deadline-less multicall variant is rejected.
- `server/rateLimit.test.ts` checks the global quote budget and confirms per-IP rejections do not
  spend that global budget.
- `server/securityHeaders.test.ts` checks that `img-src` allows only same-origin and `data:` image
  loads.

The focused tests can be run with `node --import tsx --test server/loaders/swapQuote.test.ts`,
`npm run test:rate-limit`, and `node --import tsx --test server/securityHeaders.test.ts`; the
implementation was also verified with
`node --import tsx --test server/loaders/swapTransactionVerification.test.ts`, `npm run typecheck`,
and `npm run build`.
