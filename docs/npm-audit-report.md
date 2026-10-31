# npm Audit Report — prana-stats-revamp

**Date:** 2026-10-31  
**Previous baseline:** 2026-10-23 after `follow-redirects@1.16.1` and `vite@8.3.5` (53 total: 21 low, 15 moderate, 17 high, 0 critical; `--omit=dev` 48: 21 low, 13 moderate, 14 high, 0 critical). Older baselines: 2026-10-23 before those bumps was 55 (21 low, 15 moderate, 19 high, 0 critical) and `--omit=dev` 49 (21 low, 13 moderate, 15 high, 0 critical); 2026-10-09 after Axios `1.20.0` was 53 / `--omit=dev` 48; 2026-10-09 before that override was 54 (21 low, 15 moderate, 18 high, 0 critical); 2026-08-02 was 45 (21 low, 13 moderate, 11 high, 0 critical).  
**Commands:** non-force `npm audit fix` (lockfile only; `package.json` ranges unchanged), then `npm audit` and `npm audit --omit=dev`  
**Current result (full tree):** 51 vulnerabilities (21 low, 17 moderate, 13 high, 0 critical)  
**Current result (`--omit=dev`):** 50 vulnerabilities (21 low, 17 moderate, 12 high, 0 critical)

## Overview

The number is an inventory of vulnerable packages **and every package that depends on them**. It is not 51 independent ways to attack this app.

On 2026-10-09 the Axios override moved from `1.18.1` to `1.20.0`, then `npm install` was run. Installed copy is `axios@1.20.0` (`npm ls`: `@uniswap/smart-order-router@4.31.10` → `axios@1.20.0 overridden`). `npm audit` no longer lists `axios`. That dropped the full-tree count **54 → 53** and high **18 → 17**. `ws` and `postcss` stay off the list.

On 2026-10-23 a fresh audit, before any bump, was **55** (19 high) full-tree and **49** (15 high) with `--omit=dev`. The two new highs were:

- `follow-redirects@1.16.0`. Advisories cover only `>=1.16.0 <1.16.1` (credential headers can leak across redirects). `axios@1.20.0` already depends on `follow-redirects@^1.16.0`, and Hardhat's `solc` depends on `^1.12.1`, so both already allowed `1.16.1`. `npm update follow-redirects` installed `1.16.1`. No override. This copy is on the runtime path because Axios uses it when a request redirects. The pool-list calls do not send credential headers.
- `vite@8.1.0`. Advisories cover `8.0.0`–`8.1.5` (dev server and `launch-editor`, mostly Windows). `package.json` already says `"vite": "^8.1.0"`, which means `>=8.1.0 <9.0.0`. `npm update vite` therefore installed the newest 8.x, `8.3.5`, not the minimum patched release `8.1.6`. `@vitejs/plugin-react@6.0.3` peers `vite@^8.0.0`, so `8.3.5` stays inside that peer range. Vite is dev and build only. Production runs `tsx server/index.ts`.

Both dropped off the audit. Counts returned to the 2026-10-09 baseline. `axios`, `ws`, `postcss`, `follow-redirects`, and `vite` are absent. The lockfile `postcss` copy moved `8.5.25` → `8.5.31` along with the Vite update and is still not a finding.

On 2026-10-31 a non-force `npm audit fix` applied the lockfile moves the 2026-10-23 dry-run had predicted, plus a few more patch bumps. `package.json` ranges did not change. Installed copies moved:

- `@uniswap/permit2-sdk` `1.4.0` → `1.4.1`
- `@uniswap/router-sdk` `2.11.6` → `2.11.9`
- `@uniswap/sdk-core` `7.19.4` → `7.20.0`
- `@uniswap/v2-sdk` `4.21.5` → `4.21.8`
- `@uniswap/v3-sdk` `3.31.5` → `3.31.8`
- `@uniswap/v4-sdk` `2.4.1` → `2.4.4`
- `follow-redirects` `1.16.1` → `1.16.2` (still absent from the audit)
- `happy-dom` `20.11.0` → `20.14.6` (still high; see below)
- `postcss-selector-parser` `6.1.4` → `6.1.5` (now absent, together with `postcss-nested`)
- `sucrase` `3.35.0` → `3.35.1`

Full-tree high went **17 → 13** and the total **53 → 51**. The drop is the Tailwind / `braces` chain leaving the audit (`braces`, `chokidar`, `tailwindcss`, `micromatch`, `fast-glob`) without a Tailwind 4 upgrade. One new high arrived in the same window: `happy-dom`. Moderate went **15 → 17** because `glob`, `minimatch`, `rimraf`, and `mv` came back under new advisories, while `postcss-selector-parser` and `postcss-nested` left.

The only high that disappears with `--omit=dev` is `happy-dom` (13 → 12). Low and moderate counts match in both trees. `--omit=dev` still reports Hardhat and OpenZeppelin because Uniswap publishes contract-tooling dependencies inside its normal dependency tree. That does **not** mean Hardhat runs in production. Runtime usage is the relevant distinction.

npm may still print “fix available via `npm audit fix`” for Hardhat-tree packages (`adm-zip`, `@fastify/busboy`, `serialize-javascript`, `tmp`, `undici`, …). After a fresh non-force fix those stay pinned by parent ranges. Clearing them needs upstream updates or `--force` (do not use `--force`). `--force` for the `braces` chain proposes `tailwindcss@4.3.3`, a breaking major.

## 13 high entries (2026-10-31, after non-force `npm audit fix`)

These are the 13 packages npm marks high. Several are parents flagged only because they depend on a vulnerable child. `axios` is not one of them. The 2026-10-23 set of 17 lost `braces`, `chokidar`, `tailwindcss`, `micromatch`, and `fast-glob`, and gained `happy-dom`.

### Axios — fixed by the `1.20.0` override

Installed: `axios@1.20.0`. `@uniswap/smart-order-router@4.31.10` still declares `axios@^0.21.1`. That range is not the latest Axios release. On 0.x, `^0.21.1` means `>=0.21.1 <0.22.0`, so npm would install `0.21.4`. Latest on npm as of 2026-10-31 is `1.21.0` (published 2026-10-27). `npm audit` still does not list `axios@1.20.0`, so the pin does not need to move for this audit. Removing the override, or setting it to `^0.21.1`, would downgrade off the 1.x line and bring the old advisories back. Keep `"axios": "1.20.0"` until an advisory covers that version or the router declares a range that already includes `1.20.0` or newer.

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

`braces` and `chokidar` left the audit on 2026-10-31. They are no longer in this table.

`cookie`, `diff`, `uuid`, and `mocha` stay in the low/moderate Hardhat noise around this chain. Same decision: ignore for the deployed app.

### OpenZeppelin and Uniswap parents — Solidity source, not Node runtime

`@openzeppelin/contracts` is installed as Solidity source (`3.4.2-solc-0.7` at the top, plus nested `4.7.0` and `5.0.2`). Advisories are on-chain bugs (signature checks, governor, Merkle proofs, proxy selectors). They matter only if this repo compiles or deploys those contracts. It does not. The app quotes and calls Uniswap routers already deployed on Polygon.

These packages are high only because they depend on the OpenZeppelin / ethers v5 tree. Axios is no longer in that list:

- `@uniswap/swap-router-contracts`
- `@uniswap/universal-router`
- `@uniswap/universal-router-sdk`
- `@uniswap/smart-order-router` (this one **is** used. After `axios@1.20.0`, its high flag comes from `@eth-optimism/sdk`, `@uniswap/permit2-sdk`, `@uniswap/router-sdk`, `@uniswap/swap-router-contracts`, `@uniswap/universal-router`, `@uniswap/universal-router-sdk`, `@uniswap/v3-sdk`, and `ethers`. Those children are contract packages or the legacy ethers stack, not the HTTP client.)

No fix that keeps the current router. npm's suggested fix is a semver-major downgrade (`@uniswap/smart-order-router@3.20.2` / `@uniswap/v3-sdk@3.8.3`). Do not take it.

### happy-dom — test DOM only, still high

Direct `devDependency`, range `"happy-dom": "^20.11.0"`. The non-force fix installed `20.14.6`, the newest 20.x that range allows. `npm audit` still marks it high:

- Host code execution via an unsanitized import alias. Advisory range `>=17.0.0 <=21.0.3`.
- SSRF via iframe and stylesheet when parsing untrusted HTML. Advisory range `<=20.14.6`.

npm's fix is `happy-dom@21.0.4`, a semver major. Staying on 20 cannot clear the first advisory. The only app use is `hooks/tests/renderHook.ts`, which builds a `Window` at `http://localhost/` so React hook tests can call `createRoot`. Those tests do not parse untrusted HTML. Production (`--omit=dev`) does not install this package. Do not major-bump it only to clear the count.

### Tailwind glob chain — left the audit

On 2026-10-31 `tailwindcss`, `micromatch`, `fast-glob`, `braces`, and `chokidar` are absent. `postcss-selector-parser@6.1.5` and `postcss-nested` are absent too. Tailwind itself is still 3.x (`package.json` `"tailwindcss": "^3.4.13"`). Do not upgrade to Tailwind 4 to chase a finding that is already gone.

### glob / minimatch / rimraf / mv — moderate again, toolchain only

New since the 2026-08-02 clear, and still present after the non-force fix:

- `minimatch@9.0.9` — ReDoS-style glob amplification, advisory `<11.0.1`. `mocha@11.8.0` (Hardhat peer) depends on `minimatch@^9.0.5` and `glob@^10.4.5`.
- `glob@10.5.0` — AbortSignal cancellation bypass, advisory `9.0.0`–`14.0.1`. Same Mocha parent, and `rimraf` depends on `glob` too.
- `rimraf@2.4.5` and `mv@2.1.1` — parents of that chain. `bunyan` (Hardhat's logger) depends on `mv@~2`, which pins `rimraf@~2.4.0`.

These show up in `--omit=dev` only because Hardhat is inside the Uniswap dependency tree. The app server does not run Mocha, `mv`, or these globs on request input. A fix that reaches `minimatch@11` is a major inside parents that pin 9.x. Do not force it.

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
| **Fixed (2026-10-31)** | `postcss-selector-parser@6.1.5` | Non-force fix moved `6.1.4` → `6.1.5`. `postcss-selector-parser` and `postcss-nested` are absent. |
| **Fixed (2026-10-31)** | Tailwind / `braces` chain | `braces`, `chokidar`, `tailwindcss`, `micromatch`, and `fast-glob` left the audit without a Tailwind 4 upgrade. |
| **Fixed (2026-10-23, still off the list)** | `follow-redirects@1.16.2` | `1.16.0` was the vulnerable release. `1.16.1` on 2026-10-23, then `1.16.2` via this audit fix. Used by Axios at runtime and by `solc` under Hardhat. No override. |
| **Fixed (2026-10-23)** | `vite@8.3.5` | Lockfile moved off `8.1.0`, which sat inside advisories covering `8.0.0`–`8.1.5`. Dev/build only. `package.json` range stays `^8.1.0`. |
| **Fixed (2026-10-09)** | `axios@1.20.0` | Override moved off `1.18.1`, which sat inside advisories covering `1.0.0`–`1.19.0`. `npm audit` no longer lists `axios`. Do not replace this pin with the router's declared `^0.21.1` (that installs `0.21.4`). Latest on npm as of 2026-10-31 is `1.21.0`, and `1.20.0` is still not an audit finding. |
| **Fixed** | `ws` | `viem`, `ethers`, and `@ethersproject/providers` use `8.21.1` via nested overrides. `npm audit` does not list `ws`. Remaining `ws@7.x` belongs only to Hardhat. |
| **Fixed (2026-08-02)** | `postcss` | Root `devDependencies` declare `"postcss": "^8.5.16"` (lockfile `8.5.31`). Not listed. Build/dev CSS only. |
| **Regressed (2026-10-31)** | `minimatch` / `glob` / `rimraf` / `mv` | Cleared on 2026-08-02. New advisories put `minimatch@9.0.9`, `glob@10.5.0`, `rimraf@2.4.5`, and `mv@2.1.1` back at moderate. Parents are Mocha and `bunyan` under Hardhat. `braces` itself left the list. |
| **Known noise** | `npm ls` `ELSPROBLEMS` | Override installs `ws@8.21.1` while packages still declare exact `ws@8.21.0` (`ethers`/`viem`) or `ws@8.18.0` (`@ethersproject/providers`). Tree is intentional; `npm ls` exit 1 is expected until upstream widens those pins. |
| **Track** | legacy ethers v5 / `elliptic` | Required by the current Uniswap SDK stack. Low practical risk here; no safe standalone update. The server does not hold or use wallet signing keys. |
| **Track** | `bn.js` via Optimism SDK | Uniswap's router carries Optimism bridge code; this app routes on Polygon. |
| **Track, do not force** | `happy-dom@20.14.6` | Direct devDependency. Still high until `21.0.4`. Test-only localhost window. Absent from `--omit=dev`. |
| **Ignore for production** | OpenZeppelin Solidity source, Hardhat toolchain, `glob` / `minimatch` / `rimraf` / `mv` | Classified in the 13-high section above. |

### ws — RPC WebSocket path

Narrow nested overrides update the packages that use WebSockets in the app:

- `@ethersproject/providers` (server-side legacy provider)
- `ethers` (v6)
- `viem` (wallet/RPC stack)

They deliberately do **not** force Hardhat from WebSocket 7 to 8.

**Do not bump `ethers` / `viem` just to “get `ws@8.21.1`.”**  
A package bump does not remove the override while those packages pin an exact `ws` version. The override already delivers the patched `ws` at runtime. Revisit only when upstream widens or retargets the `ws` dependency.

### postcss — frontend CSS build (2026-08-02)

Root `devDependencies` declare `"postcss": "^8.5.16"`. Vite, Tailwind, and Autoprefixer consume this at build/dev time only. Still not an audit finding on 2026-10-31. Lockfile copy is `8.5.31`.

## What not to do

- Do **not** run `npm audit fix --force`. It proposes breaking changes (semver-major downgrades of `@uniswap/smart-order-router` / `@uniswap/v3-sdk`, and `happy-dom@21.0.4`). The Tailwind 4 proposal is no longer required to clear `braces`.
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

The 2026-10-31 audit, after the non-force fix, is acceptable for the deployed runtime. `axios`, `ws`, `postcss`, `follow-redirects`, and `vite` stay off the list. The Tailwind / `braces` chain left as well. The remaining 12 production highs are inherited Hardhat and OpenZeppelin noise. The 13th high, `happy-dom`, is test-only and needs a major bump to `21.0.4` that this audit does not require.
