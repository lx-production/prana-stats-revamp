# PRANA Protocol – Network Architecture

This document describes how the app is exposed to the internet: a Raspberry Pi at home runs the app and connects to a public VPS via a **reverse SSH tunnel**. The VPS is the public face; the Pi is the private origin.

Related: [`SECURITY_OVERVIEW.md`](./SECURITY_OVERVIEW.md) inventories the security mechanisms on this path and in the swap modal.

---

## Overview

- **Public entry point:** VPS (e.g. `vps-prana.triethocduongpho.net`) — has a public IP, DNS, and SSL.
- **Origin:** Raspberry Pi at home — runs the Node app and nginx; no direct exposure to the internet.
- **Link:** Reverse SSH tunnel from Pi → VPS. The Pi opens an SSH connection to the VPS and asks it to bind port 9000 on the VPS and forward that traffic back to the Pi’s nginx (port 80).

So: **User → VPS (HTTPS) → tunnel (VPS:9000 → Pi:80) → Pi nginx → Node app or static files.**

---

## Diagram (simplified)

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  VPS (public)                                                    │
│  • nginx :443 (HTTPS), :80 → redirect to HTTPS                   │
│  • Server name: prana.triethocduongpho.net                       │
│  • SSL: Let’s Encrypt (e.g. content.triethocduongpho.net cert)   │
│  • Rate limiting, security blocks                                 │
│  • Gzip: fallback only; prefer origin precompressed `*.gz`        │
│                                                                  │
│  All HTTPS traffic is proxied to 127.0.0.1:9000                  │
└─────────────────────────────────────────────────────────────────┘
    │
    │  reverse SSH tunnel (Pi initiated)
    │  VPS:9000  ◄──────►  Pi:80
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Raspberry Pi (home, behind NAT)                                 │
│  • nginx :80 (default_server)                                    │
│  • Server name: prana.triethocduongpho.net                       │
│                                                                  │
│  /           → proxy to 127.0.0.1:4173 (Node: stats, /stake/, API)│
│  /bond/      → static files + gzip_static from disk               │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
  Node server (server/index.ts) on port 4173
  • Serves HTML, API, and JSON for the main SPA (including lazy /stake/)
  • Serves Vite `dist/` assets; prefers sibling `*.gz` (build level 9)
```

**Node rate-limit identity:** because both the VPS nginx and Pi nginx append to
`X-Forwarded-For`, the production Node service must run with
`TRUSTED_PROXY_HOP_COUNT=2`. This makes the app's per-IP swap rate limiter select the real client
IP from the two-hop proxy chain instead of the Pi nginx localhost hop.

---

## 1. VPS (public edge)

**Config reference:** `docs/vps-prana.triethocduongpho.net`

**Role:** Terminate HTTPS, apply security, then forward everything to the tunnel (localhost:9000). Compression for hashed assets is done **once at build** (gzip level 9); the VPS only applies dynamic gzip as a fallback for responses that are not already `Content-Encoding: gzip`.

- **Port 80:** Redirect to `https://prana.triethocduongpho.net`.
- **Port 443:** HTTPS with TLS 1.2/1.3 and Let’s Encrypt cert (path references `content.triethocduongpho.net`; may be a multi-domain cert).
- **Rate limiting:** 50 req/s per IP (`burst=40 nodelay`), 20 concurrent connections per IP; 429 and a custom `rate_limited.html` for blocked requests.
- **Security:** Block common scan paths (e.g. `.env`, `wp-`, `phpunit`, etc.) with immediate close (444).
- **Gzip:** `gzip on` with `gzip_comp_level 1` as fallback for API/HTML/legacy bodies without a `.gz` sibling. **Do not** strip `Accept-Encoding` on proxy — origin must see the client encoding so it can return precompressed `*.gz` (smaller payloads over the SSH tunnel, zero compress CPU per asset request).
- **Proxy:** Every request (including `/`, `/assets/`, `/stake/`, `/bond/`) is sent to `http://127.0.0.1:9000` with standard headers (Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto). Cache is explicitly off for the main location so the Pi/app control caching. Legacy `/bond/assets/` gets long-lived cache headers at the VPS edge; `/stake/` assets live under the main `/assets/` location.

So the VPS does **not** run the app; it only terminates TLS and forwards to the tunnel.

---

## 2. Reverse SSH tunnel

**Direction:** Pi (client) → VPS (server).

**Typical command (run on the Pi):**

```bash
ssh -R 9000:127.0.0.1:80 user@vps-host
```

Meaning:

- Pi keeps an SSH connection **to** the VPS.
- On the **VPS**, the SSH server binds `127.0.0.1:9000`.
- Any connection to `VPS:9000` is forwarded over the SSH connection to **Pi:80** (Pi’s nginx).

So from the internet’s perspective: user hits VPS:443 → nginx on VPS sends to 127.0.0.1:9000 → that is the tunnel → traffic appears at Pi:80.

**Important:** The Pi must initiate the SSH session. The VPS does not need to reach the Pi’s IP; it only needs to accept SSH from the Pi. That’s why this works from a home network behind NAT.

---

## 3. Raspberry Pi (origin)

**Config reference:** `docs/pi-prana.triethocduongpho.net`

**Role:** Run nginx on port 80 and the Node app on 4173; serve the main SPA (stats + lazy `/stake/`) and the legacy bond SPA.

- **Port 80:** nginx `default_server` for `prana.triethocduongpho.net`.
- **`/`:** Proxied to `http://127.0.0.1:4173` (Node server from `server/index.ts`, port from `PORT` env or 4173). Serves the main SPA shell, API, and JSON — including `/stake/` (lazy route; Node redirects bare `/stake` → `/stake/` with `308`). Forwards `Accept-Encoding` so Node can select Vite-precompressed `dist/**/*.gz`.
- **`/bond/`:** Served from `/var/www/html/prana/bond/` (legacy React SPA, try_files to `index.html`) with `gzip_static on`. No-cache headers for HTML.
- **`/bond/assets/`:** Static assets from disk with `gzip_static on`, long-lived cache, and CORS. Deploy bond builds with `*.gz` siblings next to hashed JS/CSS so static gzip can win.

So the **only** port that needs to be reachable from the tunnel is **80** (nginx). The Node app (4173) is only used by nginx on localhost.

---

## 3b. Precompressed static assets (gzip level 9)

**Build (main app):** `vite-plugin-compression2` in `config/vite.config.js` writes `*.gz` next to eligible `dist/` files at **gzip level 9** (threshold 1024 bytes). Originals are kept for clients that do not accept gzip.

**Serve (main app):** `server/serveFile.ts` checks `Accept-Encoding` and, when a sibling `.gz` exists, sends that body with `Content-Encoding: gzip` and `Vary: Accept-Encoding`.

**Serve (bond):** Pi nginx `gzip_static on` does the same for `/bond/` when `.gz` files are present on disk.

**Why not VPS `gzip_comp_level 6`:** on-the-fly compression burns CPU every request and used to force uncompressed bytes across the tunnel (`Accept-Encoding` was stripped). Precompress once at build is smaller than dynamic level 6 and cheaper at request time.

---

## 4. Request flow (end to end)

1. User requests `https://prana.triethocduongpho.net/` (or any path) with `Accept-Encoding: gzip`.
2. DNS resolves to the VPS public IP.
3. VPS nginx accepts on 443, terminates SSL, applies rate limit and security rules, then `proxy_pass` to `http://127.0.0.1:9000` **without clearing Accept-Encoding**.
4. The process listening on VPS:9000 is the SSH server (reverse tunnel). It forwards the request to the Pi over the existing SSH connection.
5. On the Pi, that connection appears as a request to `127.0.0.1:80` (nginx).
6. Pi nginx:
   - For `/` and `/stake/` (and most other paths): proxies to `http://127.0.0.1:4173` (Node app), which may return a precompressed `*.gz` body.
   - For `/bond/`: serves from disk, preferring `gzip_static` when a `.gz` sibling exists.
7. Response goes back: Node or disk → Pi nginx → tunnel (already gzip for precompressed assets) → VPS nginx → user. VPS dynamic gzip skips bodies that already have `Content-Encoding`.

---

## 5. Why this design

- **No port forwarding at home:** The Pi doesn’t need an open port on the home router; the Pi initiates the SSH connection to the VPS.
- **Single public endpoint:** SSL, rate limiting, and DDoS mitigation live on the VPS; the Pi only sees traffic that passed the VPS.
- **Simple ops:** App and nginx run on one machine (Pi); the VPS only runs nginx and SSH.

---

## 6. Config file locations

| Role   | File in repo                         | Typical deploy path (example)     |
|--------|--------------------------------------|-----------------------------------|
| VPS    | `docs/vps-prana.triethocduongpho.net` | e.g. `/etc/nginx/sites-available/` and symlink in `sites-enabled/` |
| Pi     | `docs/pi-prana.triethocduongpho.net`  | Same idea on the Pi               |

After editing, reload nginx on the relevant host: `sudo nginx -t && sudo systemctl reload nginx`.

---

## 7. Verifying prod matches GitHub `main`

After `npm run redeploy` (build + restart), anyone can check:

1. Open the site footer: **Build** shows the git tag when HEAD is tagged (link to the GitHub release), otherwise the short SHA (link to the commit).
2. Or call `GET https://prana.triethocduongpho.net/api/version` and compare `tag` (e.g. `v2.0.0`) and/or `commit` to GitHub.
3. A trailing `*` on the label means the checkout was dirty (uncommitted local changes) when that identity was resolved — not a clean public commit.

UI identity is baked at `vite build`; `/api/version` is resolved at Node process start. With the usual `redeploy` flow they match. Redeploy from a clean `main` checkout with tags fetched (`git fetch --tags`) so they match GitHub.

## 8. Operational notes

- **Binding on VPS:** The tunnel binds to 127.0.0.1:9000 on the VPS, so only nginx on the VPS can use it; that’s correct and secure.
- **SSL:** Only the VPS needs a certificate; the Pi only talks HTTP to the tunnel and to the Node app on localhost.
