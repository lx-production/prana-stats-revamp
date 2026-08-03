# Security Overview — Node App, Swap, Staking & Bonding

This document describes the security-related mechanisms currently implemented in the Node app and its Polygon Swap, Staking, and Bonding features. It is a factual inventory of how the system works today, based on the codebase.

This is not a full smart-contract, dependency, wallet-extension, or production-infrastructure audit. Frontend checks and backend preflights improve safety and UX, but the deployed contracts and the transaction finally approved by the user's wallet remain authoritative.

Production network path (VPS, reverse SSH tunnel, Pi nginx, edge TLS/rate limits) is documented in [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md).

Related docs:

- [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md) — VPS ↔ Pi reverse tunnel and edge nginx
- [`swap-modal-technical-overview.md`](./swap-modal-technical-overview.md) — swap feature end-to-end
- [`staking-technical-overview.md`](./staking-technical-overview.md) — staking feature end-to-end
- [`bonding-technical-overview.md`](./bonding-technical-overview.md) — bonding feature end-to-end

---

## 1. Node HTTP security headers

Applied to API and static responses via `setSecurityHeaders()` (`server/securityHeaders.ts`), called from `requestHelpers.ts` and `serveFile.ts`.

| Header | Behavior |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; `base-uri 'self'`; `object-src 'none'`; `frame-ancestors 'none'`; scripts from `'self'` plus Google model-viewer/Draco hosts with `'wasm-unsafe-eval'`; `style-src 'self' 'unsafe-inline'`; `img-src` / `font-src` `'self' data:`; `connect-src` same-origin + `blob:` + frontend Polygon RPC (`https://polygon.drpc.org`) + model-viewer hosts; `worker-src 'self' blob:`; `form-action 'self'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

HSTS is **not** set by Node. The TLS edge (`docs/vps-prana.triethocduongpho.net`) sends `Strict-Transport-Security: max-age=31536000` for `prana.triethocduongpho.net`, covering the homepage (swap), `/stake/`, `/bond/`, and APIs. See [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md).

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

### 2.3 Swap API surface

All swap endpoints are POST-only, JSON body, same-origin checks, body size caps, and per-IP rate limits (`server/postApiRoutes.ts`, `server/rateLimit.ts`, `server/helpers/apiRoutesHelpers.ts`, `server/helpers/postApiRoutesHelpers.ts`).

| Endpoint | Purpose | Body cap | Rate limit |
| --- | --- | --- | --- |
| `POST /api/swap/quote` | Route + unsigned tx + HMAC | 2 KB | 5 / IP / min + 30 global / min |
| `POST /api/swap/log` | Untrusted lifecycle telemetry | 8 KB | 30 / IP / min |
| `POST /api/swap/verify-transaction` | On-chain proof → verified `swap_confirmed` log | 32 KB | 10 / IP / min |

Rate limiters use fixed windows in process memory, with periodic bucket cleanup.

Client IP for rate limiting (`server/helpers/rateLimitHelpers.ts`): `X-Forwarded-For` is only trusted when the direct socket peer is a localhost proxy (`127.0.0.1` / `::1`). The client IP is then taken by counting hops from the right of the header (`TRUSTED_PROXY_HOP_COUNT`; production uses `2` because both VPS and Pi nginx append — see [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md)). Otherwise the socket address is used.

### 2.4 Shared POST request admission checks

Swap, Staking, and Bonding POST routes reuse `rejectInvalidWeb3PostRequest()`:

1. Requires `Content-Type` matching JSON (`application/json` or `*+json`).
2. If `Origin` is present, requires it to match the request `Host` / `X-Forwarded-Host` candidates (with a localhost-to-localhost exception for local dev). Missing `Origin` is allowed (non-browser clients). Mismatch → `403 forbidden_origin`.

`readJsonBody()` enforces the per-route byte cap and rejects empty bodies.

Same-origin checking is browser request admission, not authentication or authorization. All wallet-specific data comes from public on-chain state, and the user's wallet signature remains the authorization for writes.

Admission order for Web3 POSTs:

1. Shared cheap per-IP admission (`isWeb3PostAdmissionRateLimited`, 300 / IP / min) — protects Node from parse floods; no global bucket.
2. Content-Type / origin checks.
3. Capped JSON body read + feature-specific shape parse.
4. Scarce per-feature RPC/log budget (quote/confirm/verify/log).
5. Expensive work (RPC, HMAC verify, log write).

Quote and confirmation routes for Swap, Staking, and Bonding consume their expensive RPC budgets only after a valid-shaped body. Bonding and Staking account GETs still validate the address before consuming their account-read budget.

`POST /api/swap/log` and `POST /api/swap/verify-transaction` also take the shared admission check first; their feature buckets remain per-IP ingestion/verify limits (verify has no global RPC quota in this pass).

Malformed traffic is also limited at the VPS nginx edge; Node's in-process budgets are not a replacement for edge flood controls.

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
| Debounced quoting | 1000 ms after input settles; previous quote cleared when inputs change |
| Quote deadline | `SWAP_DEADLINE_SECONDS` = 3 minutes on-chain deadline in router calldata |
| Expiry buffer | Swap blocked if deadline is within 5 seconds |
| Request echo | Quote response includes request metadata; frontend requires match on chainId, tokens, `amountInRaw`, recipient, slippage, router/`to` before approve/swap |
| Manual refresh cooldown | 60 seconds |
| Network gate | `ensurePolygon()` switches injected wallet to chain `137` when needed |
| Approvals | Exact `amountInRaw` approve to SwapRouter02 when allowance is insufficient (not unlimited); native POL skips approve |
| Execution | `walletClient.sendTransaction` with server-provided `to` / `data` / `value`; reverted receipts treated as failure |

Wallet connection uses the first available injected connector (`features/web3/useInjectedWallet`).

---

## 4. Staking — security model

### 4.1 Scope and trust boundaries

- **Chain:** Polygon mainnet only (`chainId` `137`).
- **Wallet:** injected connectors; the user wallet signs EIP-712 permit data and broadcasts all writes.
- **Write target:** `stakeWithPermit`, `claimInterest`, `unstake`, and `unstakeEarly` always target the browser's hardcoded `STAKING_CONTRACT_ADDRESS`.
- **Permit scope:** EIP-2612 token domain/name/version and spender are pinned in the browser to local constants (and asserted against `/api/staking/config` before signing); the permit has a one-hour deadline.
- **Backend role:** config, account, quote, and fallback confirmation are read/verification services. The backend does not hold user keys, sign permits, or broadcast transactions.

The server builds the permit config from its own hardcoded PRANA and Staking constants. Before signing, the browser asserts those returned values against the same local constants (`PRANA_ADDRESS`, `STAKING_CONTRACT_ADDRESS`, permit domain name/version) and builds EIP-712 typed data from the local pins — not from the API response. A mismatched config fails closed without opening the wallet, so a compromised response cannot change the permit's verifying contract or spender.

### 4.2 Staking API surface

| Endpoint | Security-relevant behavior |
| --- | --- |
| `GET /api/staking/config` | `private, max-age=30`; no Node route rate limit; cached protocol pause/minimum/grace/penalty/APR and permit-domain data |
| `GET /api/staking/account?address=` | Checksum address validation; `private, no-store`; 10 / IP / min + 120 global / min; one-block balance/nonce/stakes snapshot |
| `POST /api/staking/quote` | JSON, 2 KB cap, `private, no-store`; 10 / IP / min + 60 global / min; validates body before spending RPC budget |
| `POST /api/staking/confirm-transaction` | JSON, 2 KB cap, `private, no-store`; separate 30 / IP / min + 120 global / min confirmation bucket; validates body before spending RPC budget |
| `GET /api/staking-stats` | 24-hour cached homepage aggregate only; never used to authorize or fund-gate a stake |

Canonical raw amounts and permit nonces are decimal strings rather than JavaScript numbers. Server parsers bound raw integers to `uint256`; action stake IDs are bounded to the contract's `uint32`.

### 4.3 Permit-and-stake guards

Before requesting the permit signature, the client asserts API permit fields match local pins, refetches the current wallet account/nonce, and requests a fresh quote. Before broadcasting `stakeWithPermit`, it requests another fresh quote. Wallet, chain, balance, minimum, duration, pause state, and quote issues must still be valid. The user should still verify the permit's token and spender in the wallet; the app already pins those typed-data fields to local constants.

Staking uses an exact-amount EIP-2612 permit rather than an ERC-20 `approve` transaction. The permit is invalidated in client state when its nonce, amount, duration, account, chain, or deadline no longer matches.

The quote reads pause state, minimum, APRs, Interest-contract PRANA balance, and `totalInterestNeeded` at one `blockTag`. It computes:

```text
availableInterest = max(interestBalance - totalInterestNeeded, 0)
```

The CTA is blocked when the calculated interest for the new stake does not fit. This is a **soft preflight**, not an on-chain reservation: another transaction or state change can invalidate it before execution, and the contract may still revert.

If permit signing succeeds but broadcast does not produce a transaction hash, the client may keep that permit in memory for **Continue Stake** until its amount, duration, wallet, chain, nonce context, or deadline becomes invalid. Permit signature components sent to the confirmation endpoint are used only to reconstruct and compare the already-broadcast calldata; they are not treated as credentials.

### 4.4 Staking actions and confirmation

- Claim/unstake/early-unstake targets are fixed in code. The UI derives available actions from on-chain timestamps and config, including claim-before-unstake during the grace window and an explicit early-unstake penalty warning.
- These action rules are UX guards; contract execution is authoritative. Unclaimed interest after the grace period can be lost under current contract semantics.
- Once a hash exists, the app persists `{chainId, account, hash, action, createdAt}` in `localStorage` for up to 24 hours and never rebroadcasts that action during resume.
- A fresh in-session transaction may be accepted from the browser dRPC/`publicClient` receipt. A resume/reload requires server validation of receipt status, sender, hardcoded target, and full reconstructed calldata.
- RPC lookup failure is `confirmation_unavailable`, not a revert. Only an explicit reverted receipt is reported as reverted.
- The confirmation endpoint is a UX recovery path. It does not use Swap quote HMAC/replay protection and does not create trusted analytics.

### 4.5 Staking limitations and error handling

- The Staking frontend does **not** explicitly call `simulateContract` before stake/claim/unstake writes. Wallet/client gas estimation and the contract revert remain the pre-execution safeguards.
- The 30-second config cache can briefly lag changed pause, term, or penalty state. Fresh quotes reduce this for stake eligibility, but the contract remains authoritative.
- If post-receipt account synchronization fails for a stake action, the UI can lock further action writes until reload rather than risk acting on stale account state. Account sync runs after the success UI is shown and never blocks transaction confirmation.
- Server validation errors use an allowlist; unexpected RPC/internal failures return a generic `502`. Client wallet/provider errors are mapped to stable localized messages, with raw details kept out of user-facing copy.

---

## 5. Bonding — security model

### 5.1 Scope and trust boundaries

- **Chain:** Polygon mainnet only (`chainId` `137`).
- **Create modes:** exact WBTC → PRANA Buy Bond, or exact PRANA → WBTC Sell Bond.
- **Deployments:** new bonds are created only on V2. Claims support Buy/Sell × V1/V2 through an internal side/version mapping.
- **Wallet:** injected connectors broadcast ERC-20 approval, create, and claim transactions.
- **Write targets:** token, spender, create-contract, and claim-contract addresses come from hardcoded constants, never API response addresses.

The backend supplies read snapshots and expected outputs. It cannot move funds, and it does not build an arbitrary target/calldata payload for the browser to execute.

### 5.2 Bonding API surface

| Endpoint | Security-relevant behavior |
| --- | --- |
| `GET /api/bonding/config` | `private, max-age=30`; no Node route rate limit; cached V1/V2 pause state plus V2 terms/minimum/address snapshot |
| `GET /api/bonding/account?address=` | Checksum address validation; `private, no-store`; 10 / IP / min + 120 global / min; balances, V2 allowances, and V1/V2 active bonds |
| `POST /api/bonding/quote` | JSON, 2 KB cap, `private, no-store`; 10 / IP / min + 60 global / min; validates body before spending RPC budget |
| `POST /api/bonding/confirm-transaction` | JSON, 2 KB cap, `private, no-store`; separate 30 / IP / min + 120 global / min bucket; validates body before spending RPC budget |

Quote/create/claim raw values must be canonical positive decimal `uint256` strings. Approval also accepts zero so an allowance can be revoked.

### 5.3 Quote and write guards

Each quote reads pause state, term/rate, impacted reserves, committed payout, treasury balance, and Uniswap V3 pool state at one `blockTag`. Bigint math mirrors Solidity's operation/rounding order and 1% fee. The quoted payout uses the contract's less favorable branch between impacted reserves and market reserves, and verifies that uncommitted treasury funds can cover the payout.

Before approval or create, the client successfully refetches config/account data and obtains a fresh quote with no blocking issues. It checks the response echo against the form's mode, term, and exact input. Create calldata uses the form snapshot's input, not an amount copied from the quote response.

- Approval is for the exact input amount when current allowance is insufficient; a larger existing allowance is not lowered.
- Approve, create, and claim do **not** call explicit `simulateContract`. Wallet/client gas estimation and the contract revert remain the pre-execution safeguards, matching Staking.
- Approve and create require separate user clicks and are never automatically chained.
- Form writes and claim writes lock each other while a transaction is in flight.

### 5.4 Confirmation and pending transactions

Pending Bonding hashes use the same 24-hour account/chain-bound storage and no-rebroadcast policy as Staking. Resume/reload requires server validation of sender, fixed target, and full calldata reconstructed from the action snapshot:

- approval → fixed WBTC/PRANA token + fixed V2 spender + exact amount;
- create → fixed V2 Buy/Sell function + exact input + term;
- claim → fixed Buy/Sell V1/V2 contract + bond ID.

Fresh in-session browser receipts may be trusted without server validation. The confirmation endpoint is a UX fallback only; it does not reuse Swap HMAC/replay protection or write trusted analytics.

### 5.5 Accepted payout risk: no `minOut` or deadline

The deployed Buy/Sell create functions accept exact input and term but no user-signed minimum payout or deadline. The contract recalculates payout at execution from current state. Therefore:

- the user always spends the approved exact input, but can receive less PRANA/WBTC than the UI quote;
- fresh quote and response-echo validation reduce stale-state mistakes but do **not** provide an on-chain payout guarantee;
- the wallet prompt cannot display or enforce the expected payout because it is not part of calldata;
- pricing uses current Uniswap V3 pool state rather than a TWAP, and manager-controlled or transaction-driven impacted-reserve changes can also move the result.

This is an explicit current design trade-off, not protection supplied by the UI. Re-evaluate a new contract with `minOut`/deadline if volume, concurrency, MEV exposure, average bond value, or observed quote-to-execution differences rise materially.

After the user clicks **Create Bond**, the client fresh-quotes and proceeds to the wallet without a second in-app confirmation of a changed expected payout. Because payout is absent from calldata, the wallet still cannot enforce that displayed value.

### 5.6 Bonding account-read availability limit

`GET /api/bonding/account` calls `getUserActiveBonds(address)` on all four Buy/Sell V1/V2 deployments. Each contract implementation scans its complete bond array twice, so request cost grows with total protocol bond history even when the requested address has no bonds.

Any one of those reads failing causes the entire account snapshot—balances, allowances, and bonds—to return `502`, and the loader has no request-specific RPC timeout/abort. The per-IP/global limits reduce load but do not remove this RPC amplification risk. A long-term design should index bond events and query per-user records instead of relying on four unbounded full-history scans.

### 5.7 Bonding error handling

Known body/shape and confirmation-mismatch errors are returned as sanitized `400` responses. Unexpected RPC/internal failures become generic `502` responses. Client wallet/provider failures are mapped to stable localized messages; raw RPC text is not shown to users.

---

## 6. Shared Staking/Bonding confirmation guarantees

The server confirmation helper (`server/utils/transactionConfirmationLookup.ts`) only handles already-broadcast hashes. It fetches both transaction and receipt, then:

1. returns `not_mined` if either is absent;
2. compares transaction sender, expected fixed target, and exact calldata;
3. returns `confirmed` only for receipt status `1`;
4. returns `reverted` only for receipt status `0`;
5. returns `confirmation_unavailable` on provider/read failure or unknown status.

This is deliberately narrower than Swap verification: it does not bind a server-issued quote, enforce payout, prevent quote replay, or establish trusted analytics. Local pending-transaction storage is only a resume hint and is never proof of success.

---

## 7. Build / deploy identity (ops visibility)

Not an access-control control, but relevant to knowing what binary is live:

- Footer / `GET /api/version` expose git tag and/or short commit (and dirty `*` marker when the checkout was dirty at identity resolution).
- UI identity is baked at `vite build`; `/api/version` is resolved at Node process start.

Documented in [`NETWORK_ARCHITECTURE.md`](./NETWORK_ARCHITECTURE.md) §7.

---

## 8. Process-local state (operational note)

These security state stores live in a single Node process memory and are not shared across workers or restarts:

- Shared Web3 POST admission bucket (per-IP)
- Swap, Staking, and Bonding per-IP/global feature rate-limit buckets
- Swap HMAC signing secret
- Swap quote-token replay cache

Multi-instance deploys would need shared rate-limit storage plus a shared Swap secret and replay store for behavior to be consistent across instances. Current production shape is a single Node process on the Pi.

---

## 9. Key source map

| Area | Paths |
| --- | --- |
| Network ops docs | `docs/NETWORK_ARCHITECTURE.md` |
| Security headers | `server/securityHeaders.ts` |
| Rate limits / client IP | `server/rateLimit.ts`, `server/helpers/rateLimitHelpers.ts` |
| Swap routes | `server/postApiRoutes.ts` |
| Origin / Content-Type / error sanitize | `server/helpers/apiRoutesHelpers.ts` |
| Web3 POST admission / bonding+staking sanitize / swap log metadata | `server/helpers/postApiRoutesHelpers.ts` |
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
| Shared receipt / pending safety | `features/web3/transactionConfirmation.ts`, `features/web3/waitForPolygonPublicReceipt.ts`, `features/web3/pendingTransactionStorage.ts`, `server/utils/transactionConfirmationLookup.ts` |
| Staking constants / server | `constants/stakingContracts.ts`, `server/loaders/stakingAccount.ts`, `server/loaders/stakingQuote.ts`, `server/loaders/stakingTransactionConfirmation.ts` |
| Staking client | `features/staking/hooks/useStakeTransaction.ts`, `features/staking/hooks/useStakeActions.ts`, `features/staking/utils/permitUtils.ts`, `features/staking/utils/permitConfigGuard.ts`, `features/staking/utils/stakePendingTransactionStorage.ts` |
| Bonding constants / server | `constants/bonds.ts`, `server/loaders/bondingAccount.ts`, `server/loaders/bondingQuote.ts`, `server/loaders/bondingTransactionConfirmation.ts` |
| Bonding client | `features/bonding/hooks/useBondTransaction.ts`, `features/bonding/hooks/useBondActions.ts`, `features/bonding/utils/bondQuoteEcho.ts`, `features/bonding/utils/bondPendingTransactionStorage.ts` |
| Raw integer validation | `server/utils/parseUnsignedDecimalRaw.ts`, `server/utils/stakingQuoteUtils.ts`, `server/utils/stakingConfirmationUtils.ts`, `server/utils/bondingReadUtils.ts` |
| Swap quote request parse | `server/utils/swapQuoteRequest.ts` |
| Related server tests | `server/tests/apiBoundary.test.ts`, `rateLimit.test.ts`, `securityHeaders.test.ts`, `swapQuote.test.ts`, `swapQuoteRequest.test.ts`, `swapApiAdmission.test.ts`, `swapTransactionVerification.test.ts`, `stakingApi.test.ts`, `bondingApi.test.ts` |
| Related client tests | `features/staking/tests/**`, `features/bonding/tests/**` |
