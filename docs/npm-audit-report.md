# npm Audit Report — prana-stats-revamp

**Date:** 2026-10-09  
**Previous baseline:** 2026-10-09 earlier the same day, before the Axios override bump (54 total: 21 low, 15 moderate, 18 high, 0 critical). Older baseline 2026-08-02 was 45 total (21 low, 13 moderate, 11 high, 0 critical).  
**Commands:** `npm install` after setting the Axios override to `1.20.0`, then `npm ls axios --all`, `npm audit`, `npm audit --omit=dev`  
**Current result (full tree):** 53 vulnerabilities (21 low, 15 moderate, 17 high, 0 critical)  
**Current result (`--omit=dev`):** 48 vulnerabilities (21 low, 13 moderate, 14 high, 0 critical)

## Overview

The number is an inventory of vulnerable packages **and every package that depends on them**. It is not 53 independent ways to attack this app.

On 2026-10-09 the Axios override moved from `1.18.1` to `1.20.0`, then `npm install` was run. Installed copy is `axios@1.20.0` (`npm ls`: `@uniswap/smart-order-router@4.31.10` → `axios@1.20.0 overridden`). `npm audit` no longer lists `axios`. That dropped the full-tree count **54 → 53** and high **18 → 17**. `ws` and `postcss` stay off the list.

The three high entries that disappear with `--omit=dev` are build-only: `tailwindcss`, `micromatch`, `fast-glob`. The two extra moderate entries in the full tree are the same Tailwind chain (`postcss-selector-parser`, `postcss-nested`). `--omit=dev` still reports Hardhat and OpenZeppelin because Uniswap publishes contract-tooling dependencies inside its normal dependency tree. That does **not** mean Hardhat runs in production. Runtime usage is the relevant distinction.

npm may still print “fix available via `npm audit fix`” for Hardhat-tree packages (`adm-zip`, `@fastify/busboy`, `serialize-javascript`, `tmp`, `undici`, …). After a fresh non-force fix those stay pinned by parent ranges. Clearing them needs upstream updates or `--force` (do not use `--force`). `--force` for the `braces` chain proposes `tailwindcss@4.3.3`, a breaking major.

## 17 high entries (2026-10-09, after Axios 1.20.0)

These are the 17 packages npm marks high. Several are parents flagged only because they depend on a vulnerable child. `axios` is no longer one of them.

### Axios — fixed by the `1.20.0` override

Installed: `axios@1.20.0`. `@uniswap/smart-order-router@4.31.10` still declares `axios@^0.21.1`. That range is not the latest Axios release. On 0.x, `^0.21.1` means `>=0.21.1 <0.22.0`, so npm would install `0.21.4`. Latest on npm as of this date is `1.20.0`. Removing the override, or setting it to `^0.21.1`, would downgrade off the 1.x line and bring the old advisories back. Keep `"axios": "1.20.0"` until the router declares a range that already includes `1.20.0` or newer.

`AlphaRouter` still calls Axios at runtime, now on the patched version:

- `axios.get` for hardcoded pool-list URLs: `https://cloudflare-ipfs.com/ipns/api.uniswap.org/v1/pools/{v2|v3|v4}/{chain}.json`.
- ETH Gas Station via Axios only when the provider is not a JSON-RPC provider. This app passes `StaticJsonRpcProvider`, so that branch does not run.
- Tenderly simulation (`axios.create`) is not constructed by `getSwapRouter()`.

### Hardhat toolchain — installed, not executed

Pulled in by `@uniswap/swap-router-contracts` → `hardhat-watcher` → `hardhat@2.29.1`. `npm run serve` and the Vite production server do not import or start Hardhat.

| Package | Installed | Why it is high | App impact |
|---|---|---|---|
| `undici` | `5.29.0` | HTTP/WebSocket client bugs. Only Hardhat depends on this copy. | None. This is not Node 22's built-in fetch. |
| `@fastify/busboy` | `2.1.1` | Multipart header DoS / CRLF, via that `undici`. | None. The server does not parse multipart with busboy. |
| `adm-zip` | `0.4.16` | Zip-bomb / path / SUID issues when opening untrusted zips. | None. Nothing in the app extracts zips. |
| `tmp` | `0.0.33` | Temp-path escape, via `solc`. | None. This repo does not compile Solidity. |
| `serialize-javascript` | `6.0.2` | RCE / CPU DoS when serializing attacker-controlled objects, via `mocha`. | None. Mocha is not the app test runner. |
| `hardhat`, `hardhat-watcher` | `2.29.1`, `2.5.0` | Parents of the rows above. | None unless Hardhat/contract CI is added. |
| `braces`, `chokidar` | `3.0.3`, `3.6.0` | Deeply nested glob can exhaust the stack. Also used by Tailwind. | In production the only parent is Hardhat's file watcher, which is not started. Dev/build globs come from `config/tailwind.config.js`, not from users. |

`cookie`, `diff`, `uuid`, and `mocha` stay in the low/moderate Hardhat noise around this chain. Same decision: ignore for the deployed app.

### OpenZeppelin and Uniswap parents — Solidity source, not Node runtime

`@openzeppelin/contracts` is installed as Solidity source (`3.4.2-solc-0.7` at the top, plus nested `4.7.0` and `5.0.2`). Advisories are on-chain bugs (signature checks, governor, Merkle proofs, proxy selectors). They matter only if this repo compiles or deploys those contracts. It does not. The app quotes and calls Uniswap routers already deployed on Polygon.

These packages are high only because they depend on the OpenZeppelin / ethers v5 tree. Axios is no longer in that list:

- `@uniswap/swap-router-contracts`
- `@uniswap/universal-router`
- `@uniswap/universal-router-sdk`
- `@uniswap/smart-order-router` (this one **is** used. After `axios@1.20.0`, its high flag comes from `@eth-optimism/sdk`, `@uniswap/permit2-sdk`, `@uniswap/router-sdk`, `@uniswap/swap-router-contracts`, `@uniswap/universal-router`, `@uniswap/universal-router-sdk`, `@uniswap/v3-sdk`, and `ethers`. Those children are contract packages or the legacy ethers stack, not the HTTP client.)

No fix that keeps the current router. npm's suggested fix is a semver-major downgrade (`@uniswap/smart-order-router@3.20.2` / `@uniswap/v3-sdk@3.8.3`). Do not take it.

### Tailwind glob chain — dev and build only

Full-audit only (gone with `--omit=dev`):

- `tailwindcss@3.4.19`
- `micromatch`
- `fast-glob`

Plus `braces` / `chokidar`, which also appear under Hardhat in the production tree. The DoS needs a deeply nested glob. Content globs are developer config and run when Vite/Tailwind builds or watches. The production Node server does not rescan them per request. Fixing it in npm means upgrading to Tailwind 4. Do not do that just to clear the count.

## What was fixed (still in force)

Overrides still installed:

```json
"overrides": {
  "axios": "1.20.0",
  "@ethersproject/providers": { "ws": "8.21.1" },
  "ethers": { "ws": "8.21.1" },
  "viem": { "ws": "8.21.1" }
}
```

| Status | Area | Why it matters |
|---|---|---|
| **Fixed (2026-10-09)** | `axios@1.20.0` | Override moved off `1.18.1`, which sat inside advisories covering `1.0.0`–`1.19.0`. `npm audit` no longer lists `axios`. Do not replace this pin with the router's declared `^0.21.1` (that installs `0.21.4`). |
| **Fixed** | `ws` | `viem`, `ethers`, and `@ethersproject/providers` use `8.21.1` via nested overrides. `npm audit` does not list `ws`. Remaining `ws@7.x` belongs only to Hardhat. |
| **Fixed (2026-08-02)** | `postcss` | Root `devDependencies` declare `"postcss": "^8.5.16"` (lockfile `8.5.25`). Not listed. Build/dev CSS only. |
| **Fixed (2026-08-02)** | `brace-expansion` / `minimatch` / `glob` / `rimraf` | Cleared by the earlier non-force fix. A different package, `braces`, is a new high via Tailwind/Hardhat. |
| **Known noise** | `npm ls` `ELSPROBLEMS` | Override installs `ws@8.21.1` while packages still declare exact `ws@8.21.0` (`ethers`/`viem`) or `ws@8.18.0` (`@ethersproject/providers`). Tree is intentional; `npm ls` exit 1 is expected until upstream widens those pins. |
| **Track** | legacy ethers v5 / `elliptic` | Required by the current Uniswap SDK stack. Low practical risk here; no safe standalone update. The server does not hold or use wallet signing keys. |
| **Track** | `bn.js` via Optimism SDK | Uniswap's router carries Optimism bridge code; this app routes on Polygon. |
| **Ignore for production** | OpenZeppelin Solidity source, Hardhat toolchain, Tailwind glob chain | Classified in the 17-high section above. |

### ws — RPC WebSocket path

Narrow nested overrides update the packages that use WebSockets in the app:

- `@ethersproject/providers` (server-side legacy provider)
- `ethers` (v6)
- `viem` (wallet/RPC stack)

They deliberately do **not** force Hardhat from WebSocket 7 to 8.

**Do not bump `ethers` / `viem` just to “get `ws@8.21.1`.”**  
A package bump does not remove the override while those packages pin an exact `ws` version. The override already delivers the patched `ws` at runtime. Revisit only when upstream widens or retargets the `ws` dependency.

### postcss — frontend CSS build (2026-08-02)

Root `devDependencies` declare `"postcss": "^8.5.16"`. Vite, Tailwind, and Autoprefixer consume this at build/dev time only. Still not an audit finding on 2026-10-09.

## What not to do

- Do **not** run `npm audit fix --force`. It proposes breaking changes (`tailwindcss@4.3.3`, and semver-major downgrades of `@uniswap/smart-order-router` / `@uniswap/v3-sdk`).
- Do **not** add a global `"ws": "8.21.1"` override. It would also major-upgrade Hardhat's `ws@7.x`.
- Do **not** chase the count to zero by forcing updates inside the Uniswap v5/contract dependency tree.
- Do **not** treat `npm ls` `ELSPROBLEMS` on `ws@8.21.1` as an install failure. It is the known side effect of the security override against exact upstream pins.

## Ongoing maintenance

After changing dependencies or overrides:

1. Run `npm install`, `npm ls axios ws --all` (expect `ELSPROBLEMS` while overrides pin `ws@8.21.1` against exact `8.21.0`/`8.18.0`), and `npm audit` / `npm audit --omit=dev`.
2. Update this file's date + counts when the inventory materially changes.
3. Run `npm run typecheck` and the swap tests:

   ```bash
   node --import tsx --test server/tests/swapQuote.test.ts server/tests/swapTransactionVerification.test.ts
   ```

4. Smoke-test a real quote through the normal configured Polygon RPC endpoint.
5. When upgrading `@uniswap/smart-order-router`, `ethers`, or `viem`, check whether declared Axios/`ws` ranges already include the patched versions. Remove an override only after retesting. The router's `axios@^0.21.1` does **not** include `1.20.0`; keep the exact `1.20.0` override until that declaration moves onto 1.x at `1.20.0` or newer.

The 2026-10-09 audit, after the Axios bump, is acceptable for the deployed runtime. `axios`, `ws`, and `postcss` are off the list. The remaining 17 high entries are inherited Hardhat, OpenZeppelin, and Tailwind noise.
