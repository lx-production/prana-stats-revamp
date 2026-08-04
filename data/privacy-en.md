# Privacy Policy

This Privacy Policy explains how technical data may be processed when you visit the official PRANA Protocol website or use **PRANA Swap**, **PRANA Staking**, or **PRANA Bonding** (together, the **PRANA Interfaces**). Read it together with the [Terms & Risk Disclosure](/terms).

## 1. Scope, definitions, and data controller

This policy applies to the official website and the PRANA Interfaces operated by Triết Học Đường Phố on the official domain.

In this policy:

- **“PRANA Protocol”** means the blockchain ecosystem initiated and developed by Triết Học Đường Phố on Polygon, including the PRANA token, smart contracts, technical and economic mechanisms, and related official products.

- **“Triết Học Đường Phố” or “THĐP”** means the entity that founded and develops PRANA Protocol, and that builds, publishes, and maintains the official website and user interfaces of the ecosystem.

- **“PRANA Interface”** means the collective name for **PRANA Swap**, **PRANA Staking**, and **PRANA Bonding**.

PRANA Protocol is a technical system and product name, not a separate legal entity or a data controller distinct from THĐP.

For data where THĐP decides the purposes and means of processing and directly processes that data through the website or application server, THĐP acts as the data controller and processor. Infrastructure or third-party service providers may act as data processors or as independent data controllers, depending on the service and the actual relationship.

This policy does not replace the privacy policies or terms of wallets, Polygon, Uniswap, RPC providers, hosting providers, block explorers, or other independent third parties.

Privacy questions or requests may be sent to [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net).

## 2. Important blockchain privacy notice

Public blockchains are transparent. When you submit a transaction, information such as your wallet address, token amounts, contract interactions, transaction hash, status, and timestamp becomes public on Polygon.

Public blockchain data may be permanent and may be copied, indexed, analyzed, or linked with other information by anyone. THĐP does not control Polygon and generally cannot edit or delete confirmed blockchain records.

Using a new wallet address does not guarantee anonymity.

## 3. Data processed when you visit the website

When you visit the website, some technical data may be processed automatically depending on the request and infrastructure configuration.

- client IP address
- request date and time
- requested host, path, and query parameters
- request origin or referrer when supplied by the browser
- browser or client `User-Agent`
- response status, request size, and similar diagnostic fields
- security and rate-limit information

The application server, reverse proxy, hosting provider, or CDN may create access or error logs containing some of this information.

The selected interface language (`vi` or `en`) is stored in `localStorage` on your device. The language preference remains on the device until you clear website data, change browsers or devices, or the website changes its storage mechanism.

## 4. Data processed by PRANA Swap

To produce a quote, operate the transaction flow, prevent abuse, troubleshoot failures, and verify a reported successful swap, the Swap service may process:

- wallet address used as quote recipient or transaction owner
- input and output token symbols and contract-related identifiers
- input amount, quoted output, raw output, and minimum output
- slippage setting, selected route, pools or protocols in the route, and router address
- estimated gas and relevant block information
- approval and swap lifecycle events
- transaction hash and receipt status when available
- sanitized wallet, provider, quote, routing, or transaction errors
- the request and access data described in section 3

When the browser reports a confirmed swap, the application server may retrieve the public Polygon transaction and receipt to verify the sender, target contract, calldata, value, and success status against the issued quote. Verified and unverified Swap events may be recorded in operational logs.

## 5. Data processed by PRANA Staking

After you connect a wallet, the Staking UI may request wallet-specific and quote-related data from the THĐP application server:

- **Account snapshot** (`GET /api/staking/account`) — your public wallet address is used to read public Polygon PRANA balance, Permit nonce, and active stake records, plus block metadata
- **Quote** (`POST /api/staking/quote`) — raw amount and duration needed to check whether the Interest fund can cover a new stake
- **Transaction confirmation fallback** (`POST /api/staking/confirm-transaction`) — a broadcast transaction hash plus a minimal action snapshot so the server can read the public receipt through its own Polygon RPC when the browser RPC cannot

Account, quote, and confirmation requests are rate-limited using the client IP address. Account responses are not shared across users (`private, no-store`). The wallet address can appear in request URLs or bodies and therefore in application, reverse-proxy, hosting, or access logs, depending on infrastructure configuration.

In the current version, the Staking UI does not send a separate staking lifecycle telemetry feed beyond these operational requests. The Permit signature is created in your wallet, and Stake, Claim, Unstake, and Early Unstake transactions are submitted from your browser or wallet to Polygon infrastructure.

Those wallet and blockchain providers may independently receive or process your IP address, wallet address, signed request, transaction data, and other technical information under their own policies.

## 6. Data processed by PRANA Bonding

After you connect a wallet, the Bonding UI may request wallet-specific and quote-related data from the THĐP application server:

- **Account snapshot** (`GET /api/bonding/account`) — your public wallet address is used to read public Polygon balances, allowances, and active Buy/Sell bond records (V1 and V2), plus block metadata
- **Quote** (`POST /api/bonding/quote`) — mode, raw amount, and term id needed to compute an estimated WBTC/PRANA quote from public contract and pool state
- **Transaction confirmation fallback** (`POST /api/bonding/confirm-transaction`) — a broadcast transaction hash plus a minimal action snapshot so the server can read the public receipt through its own Polygon RPC when the browser RPC cannot

Account, quote, and confirmation requests are rate-limited using the client IP address. Account responses are not shared across users (`private, no-store`). The wallet address can appear in request URLs or bodies and therefore in application, reverse-proxy, hosting, or access logs, depending on infrastructure configuration.

In the current version, the Bonding UI does not send a separate bonding lifecycle telemetry feed beyond these operational requests. Approve, create-bond, and claim transactions are submitted from your browser or wallet to Polygon infrastructure.

Those wallet and blockchain providers may independently receive or process your IP address, wallet address, signed request, transaction data, and other technical information under their own policies.

## 7. Wallet and device data

To display and perform requested actions, the browser interface may temporarily process:

- connected wallet address
- current chain and connection state
- balances, allowances, nonces, stakes, bonds, and public transaction data
- quote and form inputs
- Permit signature components, approval amounts, and pending transaction hashes
- wallet or RPC errors

This data may exist in browser memory while you use the interface. Your wallet extension or application may store its own connection or activity data independently.

Never enter or send a **seed phrase or private key** into the website, or provide either one to anyone claiming to provide PRANA support. THĐP does not need, does not request, and will not ask you to provide a seed phrase or private key.

## 8. What is not used in the current version

The current website and PRANA Interfaces do not use:

- third-party marketing analytics such as Google Analytics
- advertising tracking cookies
- behavioral advertising or sale of personal data
- internal user accounts
- custodial wallet balances maintained by THĐP

This does not mean that no technical or public blockchain data is processed. Sections 2 through 7 describe the data flows that do exist.

## 9. Purposes of processing

THĐP may process the data described above to:

- deliver website pages, Swap quotes, Staking account data, and Bonding account/quote/confirmation data requested by you
- construct, validate, and verify technical transaction flows
- maintain security, rate-limit requests, and prevent abuse
- detect, diagnose, and fix errors or availability problems
- monitor service performance and transaction-flow reliability
- investigate suspected misuse or security incidents
- comply with applicable law or valid legal requests
- establish, exercise, or defend legal claims

THĐP does not use this data to take custody of your assets or make automated investment decisions for you.

Where applicable law requires a legal basis for processing, THĐP may process data:

- to provide the functionality or perform the interaction you actively request under the agreed terms
- to comply with legal obligations or lawful requests from competent authorities
- in cases where applicable law permits processing without consent
- based on your specific consent where applicable law requires consent

Simply reading this policy, remaining silent, or not responding is not treated as consent. Where consent is required, THĐP will request it in a clear, specific, and verifiable form.

## 10. Sharing and service providers

Data may be disclosed or made available to:

- infrastructure, hosting, reverse-proxy, CDN, security, and technical service providers used to operate the website
- RPC and blockchain infrastructure providers used to read Polygon or submit and confirm transactions
- wallet providers and applications you choose to use
- Uniswap and other protocols involved in a Swap route
- block explorers and other services that index public blockchain data
- professional advisers, auditors, or incident-response providers where reasonably necessary
- public authorities or other parties when required by law or necessary to protect rights, safety, and security
- a successor operator in connection with a reorganization, transfer, or continuation of the service, subject to applicable law

These recipients may process data under their own terms and privacy policies. Public on-chain data is available to anyone without THĐP selecting the recipient.

## 11. Retention

Operational, security, and infrastructure logs are retained only for as long as reasonably necessary for the purposes described in this policy, taking into account security needs, troubleshooting, backup and log-rotation schedules, legal obligations, and the need to resolve disputes.

Different infrastructure providers may apply different retention periods under their own policies. Public blockchain records are retained by the blockchain and third-party indexers independently of THĐP and may be effectively permanent.

When data is no longer reasonably required, THĐP will delete, overwrite, or de-identify it where reasonably practicable and subject to applicable law.

## 12. Security

THĐP uses reasonable technical and organizational measures intended to protect application data against unauthorized access, loss, misuse, or alteration. No internet service, wallet, RPC, or blockchain system is completely secure, and THĐP cannot guarantee absolute security.

You are responsible for securing your wallet, device, private keys, seed phrase, and recovery methods.

## 13. Your choices and rights

You can:

- browse public parts of the website without connecting a wallet
- disconnect your wallet through the wallet or interface
- reject a signature or transaction request
- clear the saved language preference through your browser’s site-data controls
- use another compatible tool to read or interact with public contracts

Depending on applicable law, you may have rights to request information about, access to, correction of, deletion of, restriction of, or objection to certain processing of your personal data, and to withdraw consent where processing relies on consent.

Depending on applicable law, you may also have rights to lodge a complaint, file a report, bring a claim, or seek damages in connection with the processing of personal data.

THĐP will review and respond to requests within the timeframes required by applicable law. If THĐP cannot fulfill a request in whole or in part for lawful reasons, it will notify you to the extent required by law.

To make a request, email [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net). THĐP may need enough information to verify the request and identify the relevant records. Some requests may be limited by applicable law, security needs, the rights of others, or technical constraints.

THĐP cannot delete or change data recorded on Polygon or held independently by third parties.

## 14. International processing

Internet, hosting, wallet, RPC, and blockchain infrastructure may operate in multiple countries. Your technical or public blockchain data may therefore be processed outside the country where you live. Where required, THĐP will apply measures required by applicable law for cross-border processing.

## 15. Children

The PRANA Interfaces are not directed to children or to persons who lack legal capacity to conduct the relevant transactions. If you believe a child has provided personal data to THĐP through the website, contact [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net).

## 16. Changes to this policy

THĐP may update this policy when the website, data flows, service providers, or legal requirements change. The version published at `/privacy` is the current version.

Material changes should be reviewed before you continue using the PRANA Interfaces.
