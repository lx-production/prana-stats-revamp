# Privacy Policy

This document describes technical data that may be processed when you visit the official PRANA Protocol website or use the **PRANA Swap** interface. Read it together with the [Terms & Risk Disclosure](/terms).

## 1. Scope

This policy covers the website and PRANA Swap operated by THĐP on the official domain. It does not cover the separate terms of wallets, RPCs, Uniswap, Polygon, or other infrastructure providers.

## 2. Data that may be recorded

This website does **not** claim that “no data is collected.” In normal operation, the following may be processed:

**Server-side operational logs (PRANA Swap)**

- client IP address (used for rate limiting and logging)
- request `User-Agent`, host/origin
- wallet addresses when present in a request (for example `recipient` on quote requests, `ownerAddress` in swap lifecycle logs)
- technical quote and transaction fields: token pair, amounts, slippage, route, errors, and transaction hashes when available

**Infrastructure access logs**

- the application server, reverse proxy, or CDN (if used) may write technical access logs under the infrastructure’s default configuration (IP, path, timestamp, response code, and similar fields)

**Browser (local)**

- the UI language preference (`vi` / `en`) is stored in `localStorage` on your device

## 3. What is not used today

In the current version:

- no third-party marketing analytics (for example Google Analytics)
- no advertising tracking cookies
- no internal user accounts and no custodial trading balances stored by THĐP for you

## 4. Purpose of processing

The data above is used to operate the service, protect security, prevent abuse (rate limiting), debug issues, and monitor technical failures — not to sell personal data.

## 5. Storage and third parties

Logs may reside on servers or infrastructure THĐP uses to run the website. When a request passes through an RPC, wallet, or blockchain network, those parties may process data under their own terms. See also the third-party services section in the [Terms](/terms).

## 6. Updates

THĐP may update this page when collection or processing practices change. The version published at `/privacy` is the current version.
