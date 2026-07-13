# Prana Stats – Network Architecture

This document describes how the app is exposed to the internet: a Raspberry Pi at home runs the app and connects to a public VPS via a **reverse SSH tunnel**. The VPS is the public face; the Pi is the private origin.

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
│  • Rate limiting, gzip, security blocks                           │
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
│  /           → proxy to 127.0.0.1:4173 (Node app)                │
│  /stake/     → static files from /var/www/html/prana/stake/     │
│  /bond/      → static files from /var/www/html/prana/bond/      │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
  Node server (server/index.ts) on port 4173
  • Serves HTML, API, and JSON data for the main stats app
```

**Node rate-limit identity:** because both the VPS nginx and Pi nginx append to
`X-Forwarded-For`, the production Node service must run with
`TRUSTED_PROXY_HOP_COUNT=2`. This makes the app's per-IP swap rate limiter select the real client
IP from the two-hop proxy chain instead of the Pi nginx localhost hop.

---

## 1. VPS (public edge)

**Config reference:** `docs/vps-prana.triethocduongpho.net`

**Role:** Terminate HTTPS, apply security and compression, then forward everything to the tunnel (localhost:9000).

- **Port 80:** Redirect to `https://prana.triethocduongpho.net`.
- **Port 443:** HTTPS with TLS 1.2/1.3 and Let’s Encrypt cert (path references `content.triethocduongpho.net`; may be a multi-domain cert).
- **Rate limiting:** 35 req/s per IP, 10 concurrent connections per IP; 429 and a custom `rate_limited.html` for blocked requests.
- **Security:** Block common scan paths (e.g. `.env`, `wp-`, `phpunit`, etc.) with immediate close (444).
- **Gzip:** Enabled for text, JS, JSON, SVG, etc., at the VPS edge.
- **Proxy:** Every request (including `/`, `/assets/`, `/stake/`, `/bond/`) is sent to `http://127.0.0.1:9000` with standard headers (Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto). Cache is explicitly off for the main location so the Pi/app control caching.

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

**Role:** Run nginx on port 80 and the Node app on 4173; serve the main stats app and the legacy stake/bond SPAs.

- **Port 80:** nginx `default_server` for `prana.triethocduongpho.net`.
- **`/`:** Proxied to `http://127.0.0.1:4173` (Node server from `server/index.ts`, port from `PORT` env or 4173). Serves the new stats app (HTML, API, JSON).
- **`/stake/`:** Served from `/var/www/html/prana/stake/` (React SPA, try_files to `index.html`). No-cache headers for HTML.
- **`/bond/`:** Same idea from `/var/www/html/prana/bond/`.
- **`/stake/assets/` and `/bond/assets/`:** Static assets from disk with long-lived cache and CORS.

So the **only** port that needs to be reachable from the tunnel is **80** (nginx). The Node app (4173) is only used by nginx on localhost.

---

## 4. Request flow (end to end)

1. User requests `https://prana.triethocduongpho.net/` (or any path).
2. DNS resolves to the VPS public IP.
3. VPS nginx accepts on 443, terminates SSL, applies rate limit and security rules, then `proxy_pass` to `http://127.0.0.1:9000`.
4. The process listening on VPS:9000 is the SSH server (reverse tunnel). It forwards the request to the Pi over the existing SSH connection.
5. On the Pi, that connection appears as a request to `127.0.0.1:80` (nginx).
6. Pi nginx:
   - For `/`: proxies to `http://127.0.0.1:4173` (Node app).
   - For `/stake/` or `/bond/`: serves from disk.
7. Response goes back: Node or disk → Pi nginx → tunnel → VPS nginx → user.

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

1. Open the site footer: **Build** is the Vite bundle SHA (link to the GitHub commit).
2. Or call `GET https://prana.triethocduongpho.net/api/version` and compare `commit` to `https://github.com/lx-production/prana-stats-revamp/commit/<sha>` (or `origin/main`).
3. A trailing `*` on the short SHA means the checkout was dirty (uncommitted local changes) when that identity was resolved — not a clean public commit.

UI SHA is baked at `vite build`; `/api/version` is resolved at Node process start. With the usual `redeploy` flow they match. Redeploy from a clean `main` checkout so they match GitHub.

## 8. Operational notes

- **Tunnel persistence:** If the SSH session drops, the tunnel is down until the Pi reconnects. Use something like `autossh` or a systemd service that restarts the SSH tunnel so 9000 stays available.
- **Binding on VPS:** The tunnel binds to 127.0.0.1:9000 on the VPS, so only nginx on the VPS can use it; that’s correct and secure.
- **SSL:** Only the VPS needs a certificate; the Pi only talks HTTP to the tunnel and to the Node app on localhost.
