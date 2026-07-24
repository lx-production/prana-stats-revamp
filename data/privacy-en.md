# Privacy Policy

This Privacy Policy explains how technical data may be processed when you visit the official PRANA Protocol website or use **PRANA Swap** or **PRANA Staking** (together, the **PRANA Interfaces**). Read it together with the [Terms & Risk Disclosure](/terms).

## 1. Scope and operator

This policy covers the website and PRANA Interfaces operated by Triết Học Đường Phố (**THĐP**) on the official domain.

It covers data processed by the website and THĐP-operated application server. It does not replace the privacy policies or terms of your wallet, Polygon, Uniswap, RPC providers, hosting providers, block explorers, or other independent third parties.

Privacy questions or requests may be sent to [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net).

## 2. Important blockchain privacy notice

Public blockchains are transparent. When you submit a transaction, information such as your wallet address, token amounts, contract interactions, transaction hash, status, and timestamp becomes public on Polygon.

Public blockchain data may be permanent and may be copied, indexed, analyzed, or linked with other information by anyone. THĐP does not control Polygon and generally cannot edit or delete confirmed blockchain records.

Using a new wallet address does not guarantee anonymity.

## 3. Data processed when you visit the website

The website does **not** claim that no data is collected. Depending on the request and infrastructure configuration, the following technical data may be processed:

- client IP address
- request date and time
- requested host, path, and query parameters
- request origin or referrer when supplied by the browser
- browser or client `User-Agent`
- response status, request size, and similar diagnostic fields
- security and rate-limit information

The application server, reverse proxy, hosting provider, or CDN may create access or error logs containing some of this information.

The selected interface language (`vi` or `en`) is stored in `localStorage` on your device.

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

After you connect a wallet, the Staking UI requests a wallet-specific account snapshot from the THĐP application server. The request contains your public wallet address. The server uses that address to read public Polygon data, including:

- PRANA balance
- PRANA Permit nonce
- current stake records
- stake identifier, amount, start time, duration, APR, and last claim time
- relevant block number and block timestamp

The wallet address can also appear in the request URL and may therefore appear in application, reverse-proxy, hosting, or access logs, depending on infrastructure configuration. Staking account requests are rate-limited using the client IP address.

In the current version, the Staking UI does not send a separate staking lifecycle telemetry feed to the THĐP application server. The Permit signature is created in your wallet, and Stake, Claim, Unstake, and Early Unstake transactions are submitted from your browser or wallet to Polygon infrastructure.

Those wallet and blockchain providers may independently receive or process your IP address, wallet address, signed request, transaction data, and other technical information under their own policies.

## 6. Wallet and device data

To display and perform requested actions, the browser interface may temporarily process:

- connected wallet address
- current chain and connection state
- balances, allowances, nonces, stakes, and public transaction data
- quote and form inputs
- Permit signature components and pending transaction hashes
- wallet or RPC errors

This data may exist in browser memory while you use the interface. Your wallet extension or application may store its own connection or activity data independently.

THĐP does not ask for, receive, or store your seed phrase or private key through the PRANA Interfaces. Never enter either one into the website or send it to anyone claiming to provide PRANA support.

## 7. What is not used in the current version

The current website and PRANA Interfaces do not use:

- third-party marketing analytics such as Google Analytics
- advertising tracking cookies
- behavioral advertising or sale of personal data
- internal user accounts
- custodial wallet balances maintained by THĐP

This does not mean that no technical or public blockchain data is processed. Sections 2 through 6 describe the data flows that do exist.

## 8. Purposes of processing

THĐP may process the data described above to:

- deliver website pages, Swap quotes, and Staking account data requested by you
- construct, validate, and verify technical transaction flows
- maintain security, rate-limit requests, and prevent abuse
- detect, diagnose, and fix errors or availability problems
- monitor service performance and transaction-flow reliability
- investigate suspected misuse or security incidents
- comply with applicable law or valid legal requests
- establish, exercise, or defend legal claims

THĐP does not use this data to take custody of your assets or make automated investment decisions for you.

Where applicable law requires a legal basis, processing may be based on providing the service you request, THĐP’s legitimate interests in operating and securing the service, compliance with legal obligations, or consent where consent is required.

## 9. Sharing and service providers

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

## 10. Retention

Operational, security, and infrastructure logs are retained only for as long as reasonably necessary for the purposes described in this policy, taking into account security needs, troubleshooting, backup and log-rotation schedules, legal obligations, and the need to resolve disputes.

Different infrastructure providers may apply different retention periods under their own policies. Public blockchain records are retained by the blockchain and third-party indexers independently of THĐP and may be effectively permanent.

When data is no longer reasonably required, THĐP will delete, overwrite, or de-identify it where reasonably practicable and subject to applicable law.

## 11. Security

THĐP uses reasonable technical and organizational measures intended to protect application data against unauthorized access, loss, misuse, or alteration. No internet service, wallet, RPC, or blockchain system is completely secure, and THĐP cannot guarantee absolute security.

You are responsible for securing your wallet, device, private keys, seed phrase, and recovery methods.

## 12. Your choices and rights

You can:

- browse public parts of the website without connecting a wallet
- disconnect your wallet through the wallet or interface
- reject a signature or transaction request
- clear the saved language preference through your browser’s site-data controls
- use another compatible tool to read or interact with public contracts

Depending on applicable law, you may have rights to request information about, access to, correction of, deletion of, restriction of, or objection to certain processing of your personal data, and to withdraw consent where processing relies on consent.

To make a request, email [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net). THĐP may need enough information to verify the request and identify the relevant records. Some requests may be limited by applicable law, security needs, the rights of others, or technical constraints.

THĐP cannot delete or change data recorded on Polygon or held independently by third parties.

## 13. International processing

Internet, hosting, wallet, RPC, and blockchain infrastructure may operate in multiple countries. Your technical or public blockchain data may therefore be processed outside the country where you live. Where required, THĐP will apply measures required by applicable law for cross-border processing.

## 14. Children

The PRANA Interfaces are not directed to children or to persons who lack legal capacity to conduct the relevant transactions. If you believe a child has provided personal data to THĐP through the website, contact [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net).

## 15. Changes to this policy

THĐP may update this policy when the website, data flows, service providers, or legal requirements change. The version published at `/privacy` is the current version.

Material changes should be reviewed before you continue using the PRANA Interfaces.
