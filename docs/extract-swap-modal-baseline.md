# Extract Swap modal — pre-refactor baseline

Recorded from `npm run build` on 2026-07-22 (Vite 8.1.0). Use this to compare after Phase 1/2 lazy extraction. Sizes are Vite’s reported values (decimal kB).

**Compression note:** Vite’s build “gzip” column is an estimate (typically zlib default ≈ level 6), not the on-disk `*.gz` siblings. After `vite-plugin-compression2` (level 9), Node/Pi serve those siblings when `Accept-Encoding: gzip` is forwarded — see `docs/NETWORK_ARCHITECTURE.md` §3b. Re-record served sizes from prod/`Content-Length` if you need wire numbers.

## Bundle sizes

| Asset | Raw | Gzip | Notes |
|---|---|---|---|
| `index-*.js` | 317.05 kB | 101.71 kB | Eager entry: includes `WagmiProvider`, `QueryClientProvider`, `wagmiConfig` |
| `StatsPage-*.js` | 578.73 kB | 177.61 kB | Homepage page chunk; currently embeds Swap modal + Swap hooks |
| `StakingPage-*.js` | 46.74 kB | 13.75 kB | Lazy `/stake/` route (already split) |
| `fetchJson-*.js` | 270.70 kB | 81.20 kB | Shared async helper chunk |
| `ccip-*.js` | 2.87 kB | 1.33 kB | Small shared async chunk |
| `index-*.css` | 46.41 kB | 9.42 kB | Shared Tailwind stylesheet (eager) |
| `index.html` | 2.44 kB | 0.91 kB | Only references entry JS + CSS |

No separate `SwapModal-*.js` chunk exists yet — Swap ships inside `StatsPage`.

## Network requests (current behavior)

### Homepage `/` (first paint / StatsPage load)

- Eager: `/assets/index-*.js`, `/assets/index-*.css`
- Lazy page: `/assets/StatsPage-*.js` (+ shared `fetchJson-*.js` / `ccip-*.js` as imported)
- Stats API: `GET /api/prana-stats` (prefetch from `StatsPage`)
- Hero assets: model-viewer CDN script + `/prana-coin.glb` (homepage only)
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

## Topology to beat after refactor

- `/` must not download Swap feature code or Web3 vendor until **SWAP** is clicked
- `/stake/` may share an async Web3 vendor chunk with Swap; that is OK
- `main.tsx` / homepage must not import `Web3Providers`, `wagmiConfig`, or Swap hooks
