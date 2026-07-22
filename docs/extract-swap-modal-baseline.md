# Extract Swap modal — pre-refactor baseline

Recorded from `npm run build` on 2026-07-22 (Vite 8.1.0). Use this to compare after Phase 1/2 lazy extraction.

Sizes use **decimal kB** (÷ 1000), matching Vite’s build reporter.

| Column | Meaning |
|---|---|
| Raw | Uncompressed file on disk |
| Vite gzip | Build reporter estimate (zlib default ≈ level 6) — useful vs older notes / `extract-swap-modal.md` |
| On-disk `.gz` | `vite-plugin-compression2` sibling at **gzip level 9** — what Node serves when `Accept-Encoding` includes gzip (see `NETWORK_ARCHITECTURE.md` §3b) |

Characterization tests that lock formatting / wallet sanitization / provider hooks before the extract live under `utils/tests/`, `hooks/tests/`, and `features/swap/tests/` (`npm run test:client`). Pure shared extracts from step 2: `features/web3/walletFormatting.ts`, `features/web3/web3.types.ts`, `utils/tokenAmounts.ts` (`formatPranaFloatFromRaw` no longer imports `ethers`). Step 3 moved Swap-local modal/hooks/utils into `features/swap/` (shared `types/swap.types.ts`, `constants/swapContracts.ts`, and `utils/swapTokens.ts` stay outside).

## Bundle sizes

| Asset | Raw | Vite gzip | On-disk `.gz` (level 9) | Notes |
|---|---|---|---|---|
| `index-*.js` | 317.05 kB | 101.71 kB | 100.59 kB | Eager entry: includes `WagmiProvider`, `QueryClientProvider`, `wagmiConfig` |
| `StatsPage-*.js` | 578.73 kB | 177.61 kB | 175.95 kB | Homepage page chunk; currently embeds Swap modal + Swap hooks |
| `StakingPage-*.js` | 46.74 kB | 13.75 kB | 13.67 kB | Lazy `/stake/` route (already split) |
| `fetchJson-*.js` | 270.70 kB | 81.20 kB | 80.43 kB | Shared async helper chunk |
| `ccip-*.js` | 2.87 kB | 1.33 kB | 1.33 kB | Small shared async chunk |
| `index-*.css` | 46.41 kB | 9.42 kB | 9.23 kB | Shared Tailwind stylesheet (eager) |
| `index.html` | 2.44 kB | 0.91 kB | 0.92 kB | Only references entry JS + CSS |

No separate `SwapModal-*.js` chunk exists yet — Swap ships inside `StatsPage`.

For post-refactor comparisons: prefer **Raw** (topology / what code is in which chunk) and **On-disk `.gz`** (wire size after origin precompress). Keep **Vite gzip** only when matching older doc lines that cite 177.61 kB for `StatsPage`.

## Network requests (current behavior)

### Homepage `/` (first paint / StatsPage load)

- Eager: `/assets/index-*.js`, `/assets/index-*.css` (plus `index.html`)
- Lazy page: `/assets/StatsPage-*.js` (+ shared `fetchJson-*.js` / `ccip-*.js` as imported)
- Encoding: with VPS/Pi configs that **forward** `Accept-Encoding`, Node returns sibling `*.gz` bodies (`Content-Encoding: gzip`). Without that deploy, VPS may still dynamic-gzip uncompressed upstream bodies.
- Stats API: `GET /api/prana-stats` (prefetch from `StatsPage`)
- Hero assets: model-viewer CDN script + `/prana-coin.glb` (homepage only; not precompressed — dense binary)
- Chart / list data as UI mounts: root `/*.json` and other `/api/*` stats endpoints (not Swap)

Homepage does **not** call `/api/swap/*` until the user opens Swap and enters a quotable amount.

### Swap (modal open — still same StatsPage JS)

- No extra Swap JS chunk today (already in `StatsPage`)
- `POST /api/swap/quote` (debounced while form is ready)
- `POST /api/swap/log` and `POST /api/swap/verify-transaction` during approve/swap
- Injected wallet / Polygon RPC via Wagmi (providers already mounted at root)

### `/stake/`

- Lazy: `/assets/StakingPage-*.js` (+ shared chunks as needed)
- Staking config/account API calls from staking hooks
- Same root Wagmi + React Query providers (eager from `index`)

### Out of scope for this baseline

- Legacy `/bond/` UI: still uncompressed on disk; VPS dynamic gzip level 1 until a later bond precompress pass.

## Topology to beat after refactor

- `/` must not download Swap feature code or Web3 vendor until **SWAP** is clicked
- `/stake/` may share an async Web3 vendor chunk with Swap; that is OK
- `main.tsx` / homepage must not import `Web3Providers`, `wagmiConfig`, or Swap hooks
