# Extract Swap modal — bundle baseline (before / after)

Holds the **pre-refactor** snapshot and the **post-lazy** measurements after steps 5–7. Use Raw + on-disk `.gz` for topology and wire size; keep Vite gzip when matching older notes that cite 177.61 kB for `StatsPage`.

Sizes use **decimal kB** (÷ 1000), matching Vite’s build reporter.

| Column | Meaning |
|---|---|
| Raw | Uncompressed file on disk |
| Vite gzip | Build reporter estimate (zlib default ≈ level 6) — useful vs older notes / `extract-swap-modal.md` |
| On-disk `.gz` | `vite-plugin-compression2` sibling at **gzip level 9** — what Node serves when `Accept-Encoding` includes gzip (see `NETWORK_ARCHITECTURE.md` §3b) |

Characterization tests: `utils/tests/`, `features/swap/tests/`, `features/web3/tests/` (`npm run test:client`). After step 7 there are no temporary re-export shims at old paths (`utils/wagmiConfig`, `hooks/useInjectedWallet`, etc.).

Plan + outcome summary: [`extract-swap-modal.md`](./extract-swap-modal.md).

---

## Pre-refactor baseline — 2026-07-22

Recorded from `npm run build` (Vite 8.1.0) **before** Phase 1/2 lazy extraction.

### Bundle sizes

| Asset | Raw | Vite gzip | On-disk `.gz` (level 9) | Notes |
|---|---|---|---|---|
| `index-*.js` | 317.05 kB | 101.71 kB | 100.59 kB | Eager entry: includes `WagmiProvider`, `QueryClientProvider`, `wagmiConfig` |
| `StatsPage-*.js` | 578.73 kB | 177.61 kB | 175.95 kB | Homepage page chunk; embeds Swap modal + Swap hooks |
| `StakingPage-*.js` | 46.74 kB | 13.75 kB | 13.67 kB | Lazy `/stake/` route (already split) |
| `fetchJson-*.js` | 270.70 kB | 81.20 kB | 80.43 kB | Shared async helper chunk |
| `ccip-*.js` | 2.87 kB | 1.33 kB | 1.33 kB | Small shared async chunk |
| `index-*.css` | 46.41 kB | 9.42 kB | 9.23 kB | Shared Tailwind stylesheet (eager) |
| `index.html` | 2.44 kB | 0.91 kB | 0.92 kB | Only references entry JS + CSS |

No separate Swap entry chunk — Swap shipped inside `StatsPage`.

### Network requests (pre-refactor)

#### Homepage `/` (first paint / StatsPage load)

- Eager: `/assets/index-*.js`, `/assets/index-*.css` (plus `index.html`)
- Lazy page: `/assets/StatsPage-*.js` (+ shared `fetchJson-*.js` / `ccip-*.js` as imported)
- Encoding: with VPS/Pi configs that **forward** `Accept-Encoding`, Node returns sibling `*.gz` bodies (`Content-Encoding: gzip`). Without that deploy, VPS may still dynamic-gzip uncompressed upstream bodies.
- Stats API: `GET /api/prana-stats` (prefetch from `StatsPage`)
- Hero assets: model-viewer CDN script + `/prana-coin.glb` (homepage only; not precompressed — dense binary)
- Chart / list data as UI mounts: root `/*.json` and other `/api/*` stats endpoints (not Swap)

Homepage does **not** call `/api/swap/*` until the user opens Swap and enters a quotable amount.

#### Swap (modal open — still same StatsPage JS)

- No extra Swap JS chunk (already in `StatsPage`)
- `POST /api/swap/quote` (debounced while form is ready)
- `POST /api/swap/log` and `POST /api/swap/verify-transaction` during approve/swap
- Injected wallet / Polygon RPC via Wagmi (providers already mounted at root)

#### `/stake/`

- Lazy: `/assets/StakingPage-*.js` (+ shared chunks as needed)
- Staking config/account API calls from staking hooks
- Same root Wagmi + React Query providers (eager from `index`)

#### Out of scope for this baseline

- Legacy `/bond/` UI: still uncompressed on disk; VPS dynamic gzip level 1 until a later bond precompress pass.

### Topology goals (now met)

- `/` must not download Swap feature code or Web3 vendor until **SWAP** is clicked → **met**
- `/stake/` may share an async Web3 vendor chunk with Swap → **met** (`Web3Providers-*.js`)
- `main.tsx` / homepage must not import `Web3Providers`, `wagmiConfig`, or Swap hooks → **met**

---

## Post-refactor — 2026-07-22 (steps 5–7 complete)

Recorded from `npm run build` (Vite 8.1.0) after lazy `SwapEntry` / `StakingEntry`, root Web3 providers removed, chunk scan (step 6), and compatibility cleanup (step 7).

### Bundle sizes

| Asset | Raw | Vite gzip | On-disk `.gz` (level 9) | Notes |
|---|---|---|---|---|
| `index-*.js` | 232.17 kB | 75.95 kB | 75.04 kB | Eager entry: **no** Wagmi / React Query / `wagmiConfig` |
| `StatsPage-*.js` | 443.91 kB | 132.84 kB | 131.61 kB | Homepage + Swap lazy shell/error UI; **no** Swap hooks / Web3 vendor body |
| `SwapEntry-*.js` | 24.32 kB | 8.57 kB | 8.53 kB | Lazy on first **SWAP** click |
| `StakingEntry-*.js` | 46.84 kB | 13.79 kB | 13.71 kB | Lazy `/stake/` composition root (was `StakingPage-*.js`) |
| `Web3Providers-*.js` | 349.21 kB | 103.39 kB | 102.32 kB | Shared async Web3 vendor (Wagmi + TanStack Query + viem); OK for Swap + staking |
| `proxy-*.js` | 115.21 kB | 38.13 kB | 37.69 kB | Shared `framer-motion` (homepage + Swap UI) — not Web3 |
| `fetchJson-*.js` | 1.47 kB | 0.86 kB | 0.85 kB | Shared async helper (much smaller than pre-refactor) |
| `ccip-*.js` | 2.84 kB | 1.32 kB | 1.31 kB | Loaded with Web3 graph only (not homepage) |
| `utils-*.js` | 2.62 kB | 1.18 kB | 1.17 kB | Small shared bigint helper chunk |
| `index-*.css` | 46.44 kB | 9.43 kB | 9.24 kB | Shared Tailwind stylesheet (eager) |
| `index.html` | 2.44 kB | 0.91 kB | 0.92 kB | Still only references entry JS + CSS |

Delta vs pre-refactor (Raw): **entry −84.88 kB**, **StatsPage −134.82 kB**. Web3 weight moved into `Web3Providers-*.js` + feature entries.

### Import graph / chunk checks (step 6)

Scanned `index-*.js`, `StatsPage-*.js`, and homepage-shared `fetchJson` / `proxy` / `utils` / `ccip` for runtime markers:

- **Absent from entry + StatsPage bodies:** `wagmi`, `viem`, `@tanstack/react-query`, `QueryClient`, `WagmiProvider`, `wagmiConfig`, `useInjectedWallet`, `useUniswapQuote`, `useUniswapSwap`, `useStakingConfig`, `useStakingAccount`, real `ethers` package usage
- **`/api/swap`** strings live in `SwapEntry-*.js` only (not StatsPage)
- **`index.html`** still only boots `index-*.js` + `index-*.css`
- Dynamic graph: `index` → lazy `StatsPage` | lazy `StakingEntry`; `StatsPage` (hero) → lazy `SwapEntry` → `Web3Providers`; `StakingEntry` → `Web3Providers`
- String hits for `Web3Providers` inside `index` / `StatsPage` are Vite `__vite__mapDeps` preload path lists for those lazy imports — not a static module edge
- `ethers` substring inside `Web3Providers-*.js` is Polygonscan / Etherscan API URL config, not the `ethers` npm package on the homepage path

### Network requests (post-refactor)

#### Homepage `/` (first paint / StatsPage load)

- Eager: `/assets/index-*.js`, `/assets/index-*.css` (plus `index.html`)
- Lazy page: `/assets/StatsPage-*.js` (+ `fetchJson` / `proxy` / shared helpers as imported)
- **Does not** request `SwapEntry-*`, `Web3Providers-*`, `StakingEntry-*`, or `ccip-*` until user action / route change

#### Swap (first **SWAP** click)

- `/assets/SwapEntry-*.js` + `/assets/Web3Providers-*.js` (+ shared deps)
- Then quote/approve/swap API + wallet RPC as before

#### `/stake/`

- `/assets/StakingEntry-*.js` + shared `Web3Providers-*.js` (may already be cached if Swap was opened earlier)
