# npm Audit Report — prana-stats-revamp

**Date:** 2026-07-31  
**Previous baseline:** 2026-07-18 (44 total: 20 low, 13 moderate, 11 high, 0 critical)  
**Commands:** `npm audit`, `npm audit --omit=dev`, `npm ls axios ws --all`  
**Current result (full tree):** 51 vulnerabilities (20 low, 12 moderate, 19 high, 0 critical)  
**Current result (`--omit=dev`):** 49 vulnerabilities (20 low, 12 moderate, 17 high, 0 critical)

## Overview

The number is an inventory of vulnerable packages **and every package that depends on them**. It is not 51 independent ways to attack this app. The count drifted upward since 2026-07-18 mainly from newly published advisories in transitive tooling (for example `postcss`, `brace-expansion`/`minimatch`/`glob`/`rimraf` chains, and refreshed Hardhat/Undici parents) — not from a regression of the Axios/`ws` overrides.

The two production HTTP/WebSocket findings that were worth addressing remain fixed with tested, exact npm overrides:

```json
"overrides": {
  "axios": "1.18.1",
  "@ethersproject/providers": { "ws": "8.21.1" },
  "ethers": { "ws": "8.21.1" },
  "viem": { "ws": "8.21.1" }
}
```

Installed runtime copies: `axios@1.18.1`, production `ws@8.21.1`. Remaining `ws@7.5.11` belongs only to Hardhat (pulled transitively by Uniswap contract packages); this app does not run Hardhat in production.

`npm audit` no longer lists `axios` or `ws` as vulnerable packages.

| Status | Area | Why it matters |
|---|---|---|
| **Fixed** | `axios` | Smart Order Router uses `1.18.1` via override; audit alert gone. |
| **Fixed** | `ws` | `viem`, `ethers`, and `@ethersproject/providers` use `8.21.1` via nested overrides; audit alert gone. |
| **Known noise** | `npm ls` `ELSPROBLEMS` | Override installs `ws@8.21.1` while packages still declare exact `ws@8.21.0` (`ethers`/`viem`) or `ws@8.18.0` (`@ethersproject/providers`). Tree is intentional; `npm ls` exit 1 is expected until upstream widens those pins. |
| **Track** | legacy ethers v5 / `elliptic` | Required by the current Uniswap SDK stack. Low practical risk here; no safe standalone update. |
| **Track** | `bn.js` via Optimism SDK | Uniswap's router carries Optimism bridge code; this app routes on Polygon. |
| **Ignore for production** | OpenZeppelin Solidity source, Hardhat toolchain, related zip/tmp/undici parents | Installed transitively but not executed by the Vite site or Node quote/server paths that matter for Bonding/Swap/Staking. |

`npm audit --omit=dev` still reports nearly the same total. That does **not** mean Hardhat runs in production: Uniswap publishes contract-development dependencies inside its normal dependency tree, so npm cannot classify them as root `devDependencies`. Runtime usage is the relevant distinction.

## What was fixed (still in force)

### Axios — server quote path

`@uniswap/smart-order-router@4.31.10` still requests Axios `^0.21.1`. The app forces `axios@1.18.1`.

- The router only uses Axios through `get()`, `create()` and `post()`.
- Keep the override until Uniswap raises its declared Axios range.

### ws — RPC WebSocket path

Narrow nested overrides update the packages that use WebSockets in the app:

- `@ethersproject/providers` (server-side legacy provider)
- `ethers` (v6)
- `viem` (wallet/RPC stack)

They deliberately do **not** force Hardhat from WebSocket 7 to 8.

**Do not bump `ethers` / `viem` just to “get `ws@8.21.1`.”**  
As of 2026-07-31, latest `ethers@6.17.0` and `viem@2.55.10` still declare exact `ws@8.21.0`. A package bump would not remove the override need or clear `npm ls` invalid markers. The override already delivers the patched `ws` at runtime. Revisit only when upstream widens or retargets the `ws` dependency.

## What remains and how to treat it

| Remaining alert family | Audit severity | Production relevance | Decision |
|---|---:|---|---|
| `@openzeppelin/contracts` and Uniswap universal/router contract packages | High | The npm packages provide Solidity source/ABIs; this app does not deploy those contracts. | Ignore unless this repo starts compiling or deploying contracts. |
| `hardhat`, `hardhat-watcher`, `adm-zip`, `mocha`, `solc`, `serialize-javascript`, `tmp`, `undici`, `uuid`, `cookie`, `brace-expansion` / `minimatch` / `glob` / `rimraf` / `sucrase` / `mv` | Low–High | Contract-development / transitive tooling pulled in by Uniswap packages; not started by `npm run serve` or the Vite production server path. | Ignore for the deployed app. Revisit if adding Hardhat/contract CI, especially where untrusted files are processed. |
| `postcss` | High | Appears in the full-tree audit via build tooling; not a runtime server dependency for Bonding APIs. | Track with frontend toolchain upgrades; not a Bonding-API patch. |
| ethers v5 / `@ethersproject/*` / `elliptic` | Low | Used transitively by the server-side Uniswap router. The server does not hold or use wallet signing keys. | Track Uniswap's migration; do not force-update individual v5 packages. |
| `bn.js`, `web3-utils`, `ethjs-unit`, `merkletreejs`, Optimism SDK | Moderate | Legacy Optimism/bridge support within Smart Order Router; the app targets Polygon. | Accept for now; re-evaluate only if supporting Optimism or replacing the router. |

High-severity entries are mostly the OpenZeppelin/Uniswap parent chain plus unused Hardhat/tooling parents. They do not represent separate high-risk runtime services for this app.

## What not to do

- Do **not** run `npm audit fix --force`. npm proposes breaking downgrades of the wallet/provider stack.
- Do **not** add a global `"ws": "8.21.1"` override. It would also major-upgrade Hardhat's `ws@7.x`.
- Do **not** chase the count to zero by forcing updates within the Uniswap v5/contract dependency tree.
- Do **not** treat `npm ls` `ELSPROBLEMS` on `ws@8.21.1` as an install failure — it is the known side effect of the security override against exact upstream pins.

## Ongoing maintenance

After changing dependencies or overrides:

1. Run `npm install`, `npm ls axios ws --all` (expect `ELSPROBLEMS` while overrides pin `ws@8.21.1` against exact `8.21.0`/`8.18.0`), and `npm audit` / `npm audit --omit=dev`.
2. Update this file's date + counts when the inventory materially changes.
3. Run `npm run typecheck` and the swap tests:

   ```bash
   node --import tsx --test server/tests/swapQuote.test.ts server/tests/swapTransactionVerification.test.ts
   ```

4. Smoke-test a real quote through the normal configured Polygon RPC endpoint.
5. When upgrading `@uniswap/smart-order-router`, `ethers`, or `viem`, check whether declared Axios/`ws` ranges already include the patched versions; remove an override only after retesting.

The current audit remains acceptable for this app's deployed runtime: actionable Axios and `ws` alerts are resolved via overrides, and the remainder is inherited ecosystem or unused contract-tooling noise classified by production reachability above.
