# npm Audit Report — prana-stats-revamp

**Date:** 2026-07-18
**Commands:** `npm install`, `npm audit fix`, then `npm audit`
**Current result:** 44 vulnerabilities (20 low, 13 moderate, 11 high, 0 critical)

## Overview

The number is an inventory of vulnerable packages **and every package that depends on them**. It is not 44 independent ways to attack this app.

The two production HTTP/WebSocket findings that were worth addressing have been fixed with tested, exact npm overrides:

```json
"overrides": {
  "axios": "1.18.1",
  "@ethersproject/providers": { "ws": "8.21.1" },
  "ethers": { "ws": "8.21.1" },
  "viem": { "ws": "8.21.1" }
}
```

`npm ls axios ws --all` confirms that Axios is `1.18.1` and the production `ws` copies are `8.21.1`. The remaining `ws@7.5.11` belongs only to Hardhat, which this app does not run in production.

| Status | Area | Why it matters |
|---|---|---|
| **Fixed** | `axios` | Smart Order Router now uses `1.18.1`; its audit alert is gone. |
| **Fixed** | `ws` | `viem`, `ethers`, and `@ethersproject/providers` now use `8.21.1`; its audit alert is gone. |
| **Track** | legacy ethers v5 / `elliptic` | Required by the current Uniswap SDK stack. Low practical risk here; no safe standalone update. |
| **Track** | `bn.js` via Optimism SDK | Uniswap's router carries Optimism bridge code; this app routes on Polygon. |
| **Ignore for production** | OpenZeppelin Solidity source, Hardhat toolchain | Installed transitively but not executed by the Vite site or Node quote server. |

`npm audit --omit=dev` currently reports the same total. That does **not** mean Hardhat runs in production: Uniswap publishes its contract-development dependencies within its normal dependency tree, so npm cannot classify them as root dev dependencies. Runtime usage is the relevant distinction.

## What was fixed

### Axios — server quote path

`@uniswap/smart-order-router@4.31.10` still requests Axios `^0.21.1`. The app now forces `axios@1.18.1`.

- The router only uses Axios through `get()`, `create()` and `post()`.
- The override passed the swap/security tests, TypeScript check, and local HTTP-provider compatibility checks.
- Keep the override until Uniswap raises its declared Axios range.

### ws — RPC WebSocket path

The narrow overrides update the packages that use WebSockets in the app:

- `@ethersproject/providers` (server-side legacy provider)
- `ethers` (v6)
- `viem` (wallet/RPC stack)

They deliberately do **not** force Hardhat from WebSocket 7 to 8. A local `@ethersproject/providers` WebSocket-provider check passed on `ws@8.21.1`.

## What remains and how to treat it

| Remaining alert family | Audit severity | Production relevance | Decision |
|---|---:|---|---|
| `@openzeppelin/contracts` and Uniswap universal/router contract packages | High | The npm packages provide Solidity source/ABIs; this app does not deploy those contracts. | Ignore unless this repo starts compiling or deploying contracts. |
| `hardhat`, `hardhat-watcher`, `adm-zip`, `mocha`, `solc`, `serialize-javascript`, `tmp`, `undici`, `uuid`, `cookie` | Low–High | Contract-development tooling pulled in by Uniswap packages; not started by `npm run serve` or the Vite build. | Ignore for the deployed app. Revisit if adding Hardhat/contract CI, especially where untrusted files are processed. |
| ethers v5 / `@ethersproject/*` / `elliptic` | Low | Used transitively by the server-side Uniswap router. The server does not hold or use wallet signing keys. | Track Uniswap's migration; do not force-update individual v5 packages. |
| `bn.js`, `web3-utils`, `ethjs-unit`, `merkletreejs`, Optimism SDK | Moderate | Legacy Optimism/bridge support within Smart Order Router; the app targets Polygon. | Accept for now; re-evaluate only if supporting Optimism or replacing the router. |

The 11 high-severity entries are mostly the OpenZeppelin/Uniswap parent chain plus the unused Hardhat chain. They do not represent 11 separate high-risk runtime services.

## What not to do

- Do **not** run `npm audit fix --force`. npm proposes downgrading the current wallet/provider stack, which is a breaking and counterproductive change.
- Do **not** add a global `"ws": "8.21.1"` override. It would also major-upgrade Hardhat's `ws@7.x`. The nested overrides above cover the actual runtime consumers.
- Do **not** chase the count to zero by forcing updates within the Uniswap v5/contract dependency tree.

## Ongoing maintenance

After changing dependencies or overrides:

1. Run `npm install`, `npm ls axios ws --all`, and `npm audit`.
2. Run `npm run typecheck` and the swap tests:

   ```bash
   node --import tsx --test server/tests/swapQuote.test.ts server/tests/swapTransactionVerification.test.ts
   ```

3. Smoke-test a real quote through the normal configured Polygon RPC endpoint.
4. When upgrading `@uniswap/smart-order-router`, check whether it has adopted patched Axios/ethers dependencies; remove an override only after retesting.

The current audit is acceptable for this app's deployed runtime: the actionable Axios and `ws` alerts are resolved, and the remainder is inherited ecosystem or unused contract-tooling noise with the limitations described above.
