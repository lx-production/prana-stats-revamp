# npm Audit Report — prana-stats-revamp

**Date:** 2026-10-23  
**Previous baseline:** 2026-10-09 after the Axios override bump (53 total: 21 low, 15 moderate, 17 high, 0 critical; `--omit=dev` 48: 21 low, 13 moderate, 14 high, 0 critical). The same-day check on 2026-10-23, before the `follow-redirects` and Vite bumps, was 55 total (21 low, 15 moderate, 19 high, 0 critical) and `--omit=dev` 49 (21 low, 13 moderate, 15 high, 0 critical). Older baselines: 2026-10-09 before Axios `1.20.0` was 54 (21 low, 15 moderate, 18 high, 0 critical); 2026-08-02 was 45 (21 low, 13 moderate, 11 high, 0 critical).  
**Commands:** `npm update follow-redirects`, `npm update vite` (lockfile `vite@8.3.5`; `package.json` stays `"vite": "^8.1.0"`), production build succeeded, then `npm audit`, `npm audit --omit=dev`, and `npm audit fix --dry-run`  
**Current result (full tree):** 53 vulnerabilities (21 low, 15 moderate, 17 high, 0 critical)  
**Current result (`--omit=dev`):** 48 vulnerabilities (21 low, 13 moderate, 14 high, 0 critical)

## Overview

The number is an inventory of vulnerable packages **and every package that depends on them**. It is not 53 independent ways to attack this app.

On 2026-10-09 the Axios override moved from `1.18.1` to `1.20.0`, then `npm install` was run. Installed copy is `axios@1.20.0` (`npm ls`: `@uniswap/smart-order-router@4.31.10` → `axios@1.20.0 overridden`). `npm audit` no longer lists `axios`. That dropped the full-tree count **54 → 53** and high **18 → 17**. `ws` and `postcss` stay off the list.

On 2026-10-23 a fresh audit, before any bump, was **55** (19 high) full-tree and **49** (15 high) with `--omit=dev`. The two new highs were:

- `follow-redirects@1.16.0`. Advisories cover only `>=1.16.0 <1.16.1` (credential headers can leak across redirects). `axios@1.20.0` already depends on `follow-redirects@^1.16.0`, and Hardhat's `solc` depends on `^1.12.1`, so both already allowed `1.16.1`. `npm update follow-redirects` installed `1.16.1`. No override. This copy is on the runtime path because Axios uses it when a request redirects. The pool-list calls do not send credential headers.
- `vite@8.1.0`. Advisories cover `8.0.0`–`8.1.5` (dev server and `launch-editor`, mostly Windows). `package.json` already says `"vite": "^8.1.0"`, which means `>=8.1.0 <9.0.0`. `npm update vite` therefore installed the newest 8.x, `8.3.5`, not the minimum patched release `8.1.6`. `@vitejs/plugin-react@6.0.3` peers `vite@^8.0.0`, so `8.3.5` stays inside that peer range. Vite is dev and build only. Production runs `tsx server/index.ts`.

Both dropped off the audit. Counts returned to the 2026-10-09 baseline. `axios`, `ws`, `postcss`, `follow-redirects`, and `vite` are absent. The lockfile `postcss` copy moved `8.5.25` → `8.5.31` along with the Vite update and is still not a finding.

`npm audit fix --dry-run` on this date still finishes at 53. It would only move a few Uniswap SDK patch versions and `postcss-selector-parser` `6.1.4` → `6.1.5`. `6.1.5` stays inside the `<7.1.6` advisory, so that bump does not clear the finding.

The three high entries that disappear with `--omit=dev` are build-only: `tailwindcss`, `micromatch`, `fast-glob`. The two extra moderate entries in the full tree are the same Tailwind chain (`postcss-selector-parser`, `postcss-nested`). `--omit=dev` still reports Hardhat and OpenZeppelin because Uniswap publishes contract-tooling dependencies inside its normal dependency tree. That does **not** mean Hardhat runs in production. Runtime usage is the relevant distinction.

npm may still print “fix available via `npm audit fix`” for Hardhat-tree packages (`adm-zip`, `@fastify/busboy`, `serialize-javascript`, `tmp`, `undici`, …). After a fresh non-force fix those stay pinned by parent ranges. Clearing them needs upstream updates or `--force` (do not use `--force`). `--force` for the `braces` chain proposes `tailwindcss@4.3.3`, a breaking major.

## 17 high entries (2026-10-23; same set as 2026-10-09 after Axios 1.20.0)

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
| **Fixed (2026-10-23)** | `follow-redirects@1.16.1` | Lockfile moved off `1.16.0`. Used by Axios at runtime and by `solc` under Hardhat. No override. `npm audit` no longer lists it. |
| **Fixed (2026-10-23)** | `vite@8.3.5` | Lockfile moved off `8.1.0`, which sat inside advisories covering `8.0.0`–`8.1.5`. Dev/build only. `package.json` range stays `^8.1.0`. |
| **Fixed (2026-10-09)** | `axios@1.20.0` | Override moved off `1.18.1`, which sat inside advisories covering `1.0.0`–`1.19.0`. `npm audit` no longer lists `axios`. Do not replace this pin with the router's declared `^0.21.1` (that installs `0.21.4`). Latest Axios on npm as of 2026-10-23 is still `1.20.0`. |
| **Fixed** | `ws` | `viem`, `ethers`, and `@ethersproject/providers` use `8.21.1` via nested overrides. `npm audit` does not list `ws`. Remaining `ws@7.x` belongs only to Hardhat. |
| **Fixed (2026-08-02)** | `postcss` | Root `devDependencies` declare `"postcss": "^8.5.16"` (lockfile `8.5.31` on 2026-10-23). Not listed. Build/dev CSS only. |
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

Root `devDependencies` declare `"postcss": "^8.5.16"`. Vite, Tailwind, and Autoprefixer consume this at build/dev time only. Still not an audit finding on 2026-10-23. Lockfile copy is `8.5.31`.

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

The 2026-10-23 audit, after the `follow-redirects` and Vite bumps, matches the acceptable 2026-10-09 baseline. `axios`, `ws`, `postcss`, `follow-redirects`, and `vite` are off the list. The remaining 17 high entries are inherited Hardhat, OpenZeppelin, and Tailwind noise.
