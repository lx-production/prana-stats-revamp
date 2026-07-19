# PRANA Stats

Live dashboard for the [PRANA](https://prana.triethocduongpho.net) protocol — staking, bonding, liquidity, supply, price performance, and on-site swap — with a small Node API that serves the UI and JSON snapshots.

**Live:** [https://prana.triethocduongpho.net](https://prana.triethocduongpho.net)

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind
- **Backend:** Node HTTP server (`server/`) — readonly stats APIs, swap quote helpers, static `dist/`
- **Deploy:** Raspberry Pi origin behind a VPS reverse SSH tunnel (see docs)

## Develop

```bash
npm install
npm run dev:all    # API on :4174, Vite on :5173
```

Useful scripts: `npm run build`, `npm run serve`, `npm run typecheck`, `npm run redeploy` (prod on the Pi).

## Verify production matches this repo

1. Footer **Build** shows the git tag when the checkout is tagged (e.g. `v2.0.0` → GitHub release), otherwise the short SHA → commit link
2. Or `GET /api/version` and compare `tag` / `commit` to GitHub

Details: [docs/NETWORK_ARCHITECTURE.md](docs/NETWORK_ARCHITECTURE.md) (§7).

## Docs


| Doc                                                                            | Topic                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------ |
| [docs/NETWORK_ARCHITECTURE.md](docs/NETWORK_ARCHITECTURE.md)                   | How prod is exposed (VPS ↔ Pi)             |
| [docs/CACHE_ARCHITECTURE.md](docs/CACHE_ARCHITECTURE.md)                       | API/data caching, including `/api/version` |
| [docs/swap-modal-technical-overview.md](docs/swap-modal-technical-overview.md) | Swap quote / verify flow                   |
| `/terms`                                                                       | Terms / Risk Disclosure page (footer link) |


Machine-readable summary: `[/api/summary](https://prana.triethocduongpho.net/api/summary)`.