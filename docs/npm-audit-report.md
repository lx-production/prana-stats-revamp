# npm Audit Report — prana-stats-revamp

**Date:** 2026-06-30  
**Command:** `npm audit`  
**Result:** 47 vulnerabilities (17 low, 17 moderate, 13 high, 0 critical)

This report explains which findings matter for **this** app (a Vite React frontend + Node swap-quote backend) and which are mostly noise from deep transitive dependencies in the Uniswap / Ethereum tooling ecosystem.

---

## Executive summary

Most of the 47 items are **not urgent**. npm audit counts the same root problem many times as it walks the dependency tree, so the number looks worse than the real risk.

| Priority | Count (approx.) | What to do |
|----------|-----------------|------------|
| **Worth tracking** | 2 areas (`axios`, `ws`) | Monitor upstream Uniswap/viem releases; consider `overrides` later |
| **Low urgency** | ~5 (`bn.js`, `elliptic`, legacy `ethers` v5) | Accept for now; tied to Uniswap SDK internals |
| **Safe to ignore (for this app)** | ~40 | Dev-only tools (`hardhat`, `mocha`, `solc`) or on-chain Solidity libs (`@openzeppelin/contracts`) |

**Do run:** `npm audit fix` (safe, non-breaking fixes for dev-tooling deps)  
**Do not run blindly:** `npm audit fix --force` (would downgrade `viem` / `@ethersproject/providers` and likely break the swap feature)

---

## How this project uses the flagged packages

Understanding *where* code runs is the key to prioritizing.

```
Browser (production)          Node server (production)           Installed but unused at runtime
─────────────────────         ──────────────────────────           ───────────────────────────────
viem, wagmi  → wallet/RPC    @uniswap/smart-order-router        hardhat, mocha, solc, undici
ws (via viem) → WebSockets   axios (via smart-order-router)     (pulled in by Uniswap contract
ethers v6    → reads/txs     @ethersproject/providers            packages for compilation)
                             ethers v5 (inside Uniswap SDKs)
```

The swap backend (`server/loaders/swapQuote.ts`) uses `@uniswap/smart-order-router` on the server. The frontend uses `viem` / `wagmi` for wallet connection. Neither path intentionally runs Hardhat or compiles Solidity in production.

---

## Tier 1 — Worth paying attention to

These touch **production** code paths (browser or swap server).

### 1. `axios` ≤ 0.31.1 — **High** (server-side)

| Detail | Value |
|--------|-------|
| Installed version | `0.21.4` |
| Brought in by | `@uniswap/smart-order-router` |
| Runs in | Node backend when fetching quotes |
| Fix available | No (needs upstream Uniswap update) |

**What it is:** A very old HTTP client with many known issues (SSRF, header injection, DoS, credential leakage in proxy scenarios).

**Why it matters here:** The swap quote server uses Smart Order Router, which uses `axios` internally to call external APIs (subgraphs, routing endpoints, etc.).

**Realistic risk for this app:** **Medium-low.** Your server does not expose arbitrary URLs to `axios` — users pick tokens and amounts, not HTTP endpoints. The main concerns would be a compromised upstream endpoint or a future code path that forwards user-controlled URLs. Still the **most actionable production finding** in this audit.

**What to do:**
- Watch for new `@uniswap/smart-order-router` releases that bump `axios`.
- Optionally add an npm `overrides` entry to force `axios@^1.8.0` and run swap quote tests (may break if the router relies on old axios behavior).
- Do **not** panic — this is inherited from Uniswap, not something you introduced.

### 2. `ws` 8.0.0 – 8.20.1 — **High** (browser + server)

| Detail | Value |
|--------|-------|
| Installed versions | `8.20.1` (viem), `8.18.0` (@ethersproject/providers), `8.21.0` (ethers v6 — likely OK) |
| Brought in by | `viem`, `@ethersproject/providers`, `ethers` |
| Runs in | WebSocket RPC connections (wallet + server provider) |
| Fix available | Only via `npm audit fix --force` (breaking; **do not use**) |

**What it is:** WebSocket library issues — uninitialized memory disclosure and memory-exhaustion DoS from tiny frames.

**Why it matters here:** `viem` (frontend wallet) and `@ethersproject/providers` (server RPC) open WebSockets to Alchemy / Polygon RPC.

**Realistic risk for this app:** **Low-medium.** You connect to trusted RPC providers, not random user servers. DoS via malicious WebSocket server is theoretically possible if an RPC endpoint were compromised. Memory disclosure is a bigger concern in Node than in the browser sandbox.

**What to do:**
- Wait for `viem` to ship with `ws@≥8.20.2` (or whatever patched version npm advisory recommends).
- Your direct `ethers@^6.15.0` already pulls a newer `ws`; the gap is mainly in `viem`'s nested copy.
- Avoid `npm audit fix --force` — it suggests downgrading `@ethersproject/providers` to `5.7.2`, which is a step backward.

---

## Tier 2 — Low urgency (production-adjacent, hard to fix)

These appear in production dependency trees but are unlikely to be exploitable in normal swap usage.

### `bn.js` < 4.12.3 — **Moderate**

- Chain: `@uniswap/smart-order-router` → `@eth-optimism/sdk` → `merkletreejs` → `web3-utils` → `bn.js`
- **Issue:** Infinite loop on crafted input.
- **Risk here:** Optimism bridge code in the router. Your app targets **Polygon only**; this path is rarely exercised. Low priority.

### `elliptic` * — **Low** (listed low, but crypto-related)

- Chain: legacy `ethers` v5 / `@ethersproject/signing-key` inside Uniswap SDKs.
- **Issue:** Generic advisory about ECDSA implementation quality — not a specific remote exploit.
- **Risk here:** Your app signs transactions with the **user's wallet** (MetaMask), not with server-side keys via `elliptic`. The v5 `ethers` copy is used for encoding/routing math, not holding secrets. Low priority.

### Legacy `@ethersproject/*` and `ethers` v5 — **Low / Moderate**

- You depend on `@ethersproject/providers@^5.8.0` directly for the server router, while main app code uses `ethers` v6.
- Most advisories here trace back to `elliptic` or `ws` (covered above).
- **Risk here:** Expected cost of using Uniswap's v5-based SDK on the server. No simple fix without Uniswap migrating fully to v6.

### `uuid` < 11.1.1 — **Moderate**

- Chain: `hardhat` only.
- **Risk here:** Dev tooling. Ignore for production.

---

## Tier 3 — Not important for this app

These inflate the vulnerability count but do **not** affect your running site or swap server in normal operation.

### `@openzeppelin/contracts` ≤ 4.9.5 — **High** (13 advisory entries)

- Brought in by Uniswap router/contract SDK packages.
- **What the advisories describe:** Bugs in **deployed Solidity contracts** (Governor, SignatureChecker, MerkleProof, proxies, etc.).
- **Why it does not matter here:** npm only ships the `.sol` source and ABI helpers. Your Node/browser app does **not** deploy or execute those contracts. Uniswap's on-chain contracts were deployed separately with their own audits.
- **Verdict:** Audit noise for application security. Ignore unless you start deploying contracts from this repo.

### `hardhat`, `mocha`, `solc`, `serialize-javascript`, `tmp`, `undici`, `cookie` — various severities

| Package | Severity | Via | Why ignore |
|---------|----------|-----|------------|
| `hardhat` | moderate | `@uniswap/swap-router-contracts` → `hardhat-watcher` | Ethereum dev framework; not run in `npm run serve` |
| `mocha` | moderate | `hardhat` | Test runner only |
| `solc` | low | `hardhat` | Solidity compiler; not invoked at runtime |
| `serialize-javascript` | high | `mocha` | Test report serialization; dev only |
| `tmp` | high | `solc` | Temp files during compilation; dev only |
| `undici` | high | `hardhat` | Node fetch in Hardhat; dev only |
| `cookie` | low | `@sentry/node` → `hardhat` | Hardhat telemetry; dev only |

**Verdict:** Running `npm audit fix` may patch some of these (uuid, undici, cookie, etc.) with zero effect on production because they are never loaded by `vite build` or `node server/index.ts`.

---

## What `npm audit fix` will and won't do

### Safe to run

```bash
npm audit fix
```

Expected impact:
- May update `uuid`, `undici`, `cookie`, `serialize-javascript`, `tmp`, and some `hardhat` sub-deps.
- Touches **dev tooling only** in practice.
- Will **not** clear the important `axios`, `ws`, `@openzeppelin/contracts`, or `elliptic` findings.

### Do not run without a plan

```bash
npm audit fix --force   # ← avoid
```

npm warns this would install `@ethersproject/providers@5.7.2` (older than your `5.8.0`) and bizarrely suggests downgrading `viem` to `0.2.1` / `wagmi` to `0.12.19` — that would **break** the current wallet stack.

---

## Recommended action plan

### Now (5 minutes)

1. Run `npm audit fix` to pick up harmless dev-dependency patches.
2. Re-run `npm audit` — expect the count to drop slightly; the important items will remain.

### Soon (when you have time)

1. **Swap quote smoke test** after any dependency change (`npm run serve` + request a quote from the UI).
2. Check whether a newer `@uniswap/smart-order-router` exists with a newer `axios`.
3. Check `viem` / `wagmi` release notes for `ws` bumps.

### Later (optional hardening)

1. Add npm `overrides` for `axios` and/or `ws` only after testing — example:

   ```json
   "overrides": {
     "axios": "^1.8.0",
     "ws": "^8.21.0"
   }
   ```

2. Consider replacing `@ethersproject/providers` with `ethers` v6 `JsonRpcProvider` on the server to reduce the dual-ethers footprint (code change, not just a version bump).

### Do not waste time on

- Chasing all 47 to zero — many are duplicates and unfixable without upstream ecosystem moves.
- `@openzeppelin/contracts` advisories — irrelevant unless you deploy contracts.
- `hardhat` / `mocha` / `solc` — irrelevant unless you add contract compilation to CI.

---

## Full vulnerability inventory

Grouped by root package (npm audit deduplicated view).

### High (13)

| Package | Direct dep? | Production? | Fix? | Verdict |
|---------|-------------|-------------|------|---------|
| `axios` | no | **yes** (server) | no | **Track** |
| `ws` | no | **yes** (browser + server) | force only | **Track** |
| `viem` | **yes** | **yes** | force only (bad) | Flagged because of `ws` |
| `wagmi` | **yes** | **yes** | force only (bad) | Flagged because of `viem` → `ws` |
| `@uniswap/smart-order-router` | **yes** | **yes** | no | Flagged because of `axios` + OZ + ethers v5 |
| `@openzeppelin/contracts` | no | no (ABI only) | no | **Ignore** |
| `@uniswap/universal-router` | no | no | no | **Ignore** (OZ) |
| `@uniswap/universal-router-sdk` | no | bundled in router | no | **Ignore** (OZ + ethers v5) |
| `serialize-javascript` | no | no | yes | **Ignore** (mocha) |
| `tmp` | no | no | yes | **Ignore** (solc) |
| `undici` | no | no | yes | **Ignore** (hardhat) |
| `@wagmi/connectors` | no | yes | force only (bad) | Transitive via `wagmi` |
| `@wagmi/core` | no | yes | force only (bad) | Transitive via `wagmi` |

### Moderate (17)

Mostly `@uniswap/*` SDK packages, `hardhat`, `ethers` v5, `bn.js`, `uuid`, `@ethersproject/providers` (direct dep). See tiers above — only `@ethersproject/providers` and `bn.js` have any production relevance, both low urgency.

### Low (17)

`elliptic`, `@ethersproject/*` internals, `@eth-optimism/*`, `cookie`, `solc`. Almost all trace to dev tooling or legacy ethers v5 inside Uniswap. **Ignore** for practical purposes.

---

## Key direct dependencies in `package.json`

These are the packages *you* chose; everything else is transitive.

| Package | Role | Audit concern |
|---------|------|---------------|
| `@uniswap/smart-order-router` | Server quote routing | Pulls `axios`, OZ, ethers v5, optimism SDK |
| `@uniswap/router-sdk`, `@uniswap/v3-sdk` | Route encoding | Pulls OZ, ethers v5, hardhat (dev) |
| `@ethersproject/providers` | Server JSON-RPC | `ws` advisory |
| `viem`, `wagmi` | Frontend wallet | `ws` advisory |
| `ethers` v6 | Tx building, reads | Cleanest dep; newer `ws` |

---

## Glossary (simple)

- **Direct dependency:** Listed in your `package.json`.
- **Transitive dependency:** A dependency of your dependency (most of this audit).
- **npm audit fix:** Updates packages within allowed semver ranges — safe first step.
- **npm audit fix --force:** May install major downgrades — dangerous here.
- **override:** Forces a specific version for all copies of a package in the tree; use with testing.

---

## References

- [swap-ui-review.md](./swap-ui-review.md) — architecture of the swap feature affected by these deps
- npm advisories linked in `npm audit` output (GHSA IDs)
- Re-run audit anytime: `npm audit`
