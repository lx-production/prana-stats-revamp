# Terms & Risk Disclosure

This document applies to the official PRANA Protocol website and its transaction interfaces, including **PRANA Swap**, **PRANA Staking**, and **PRANA Bonding** (together, the **PRANA Interfaces**). Please read it carefully before connecting a wallet, signing a message, or confirming a transaction.

By using a PRANA Interface, you acknowledge that you understand and accept these terms and the risks described below. If you do not agree, do not use the PRANA Interfaces.

## 1. Nature of the PRANA Interfaces

The PRANA Interfaces are technical, non-custodial interfaces that help users interact with public smart contracts on the Polygon blockchain.

Triết Học Đường Phố (**THĐP**):

- does not create an internal trading, staking, or bonding account for you
- does not control your wallet, private keys, or seed phrase
- cannot sign transactions for you
- cannot reverse, cancel, or recover a transaction after it is confirmed on-chain

You remain in control of your wallet. However, when you stake PRANA, the staked principal is transferred from your wallet to the Staking Contract and is then governed by that contract until it is returned under the contract rules. When you create a bond, the input token (WBTC or PRANA) is transferred to the matching Bond contract and the payout vests under that contract’s rules until claimed.

Smart contracts are not the same as a bank account or a custodial account. Assets held by a smart contract may be exposed to contract, blockchain, configuration, and operational risks.

## 2. Eligibility and lawful use

You must have full legal capacity under applicable law and be of sufficient age to enter into transactions on your own. You may not use a PRANA Interface on behalf of another person without lawful authority.

You are responsible for determining whether your use of PRANA, swaps, staking, bonding, and the PRANA Interfaces is lawful in your nationality, residence, and jurisdiction.

**Do not use a PRANA Interface** if your use is restricted or prohibited by applicable law.

## 3. No investment, legal, or tax advice

Information on the website, in product announcements, and in the PRANA Interfaces is provided only to describe PRANA Protocol, its public data, and the available technical interactions.

This information is **not**:

- investment or financial advice
- legal advice
- tax advice
- a recommendation or guarantee for any person

You alone are responsible for deciding whether to buy, sell, hold, swap, stake, bond, claim, or unstake digital assets. You should obtain independent professional advice where appropriate.

## 4. General digital-asset and blockchain risks

Digital assets and decentralized protocols involve substantial risk, including without limitation:

- sharp price volatility and loss of market value
- thin, unavailable, or suddenly changing liquidity
- smart-contract bugs, vulnerabilities, exploits, or unexpected behavior
- blockchain reorganizations, outages, congestion, delayed confirmations, or abnormal gas costs
- incorrect, delayed, stale, or unavailable data from RPC or other infrastructure providers
- wallet compromise, phishing, malware, malicious approvals, or user error
- fake tokens, spoofed contract addresses, impersonated websites, or modified interfaces
- regulatory, tax, or legal changes
- transactions or asset losses that cannot be reversed or recovered

No price, profit, yield, liquidity, principal recovery, interest payment, or transaction outcome is guaranteed.

## 5. PRANA Swap summary and specific risks

PRANA Swap helps users request routes and submit swaps through Uniswap smart contracts on Polygon. In the current interface:

- swaps are executed through Uniswap SwapRouter02
- supported assets are selected by the interface
- the interface uses a fixed slippage setting
- ERC-20 swaps may require a separate approval transaction
- native POL swaps do not require an ERC-20 approval

Swap quotes are estimates, not guarantees. The final result can differ or a transaction can fail because of slippage, price movement, liquidity changes, gas estimation, routing, token behavior, MEV, blockchain conditions, or third-party failures.

For ERC-20 swaps, PRANA Swap currently requests approval for the exact input amount rather than an unlimited approval. An unused or partially used allowance may nevertheless remain on-chain after a cancelled or failed swap. You are responsible for reviewing and revoking allowances when appropriate.

PRANA Swap currently charges no separate interface or routing fee. You may still incur:

- Polygon network gas
- liquidity-provider fees in the pools used by the route
- price impact and slippage

The WBTC/PRANA pool currently uses a 1% liquidity-provider fee, and THĐP has provided liquidity to that pool. This does not remove price, liquidity, conflict, or loss risk. A route may use more than one pool, and its quote may reflect multiple pool fees.

## 6. PRANA Staking summary and specific risks

PRANA Staking creates and manages PRANA stake positions through the Staking Contract on Polygon. For wallet actions and UI flow details, see the [Staking Guide](/guide/staking/) and [Staking Contracts Explained](/guide/staking-contracts/).

**Key risks**

- The interface uses an EIP-2612 Permit and then `stakeWithPermit`; one button may trigger two wallet prompts in sequence. A Permit is an authorization — reject it if any detail looks unexpected.
- Principal is locked until maturity unless you early-unstake. Early unstake deducts a penalty from principal and forfeits all unclaimed interest for that position; the penalty is a smart-contract rule, not a THĐP interface fee.
- Displayed APR and interest are PRANA-denominated estimates and do not guarantee fiat value, purchasing power, or profit. Final on-chain amounts may differ because of timestamps, rounding, or stale interface data.
- Claiming interest depends on the Interest Contract being sufficiently funded and not paused; claims may fail due to network/RPC issues or reverts. THĐP does not guarantee that every expected interest amount will be available or successfully paid for reasons beyond its control.
- After maturity, interest can be claimed only during the grace period. Unstaking before claiming may forfeit unclaimed interest, even though the UI has safeguards against this. After the grace period ends, unclaimed interest can no longer be claimed; you are responsible for monitoring and claiming on time.
- The owner can pause and change global configuration (available APRs, minimums, grace period, penalty). The APR of an existing position is fixed at creation; pause, administrative keys, and Interest Contract funding remain risks. Cross-check on-chain state before acting.

## 7. PRANA Bonding summary and specific risks

PRANA Bonding helps users create and manage Buy and Sell bonds through Bond contracts on Polygon. **New bonds are created only on V2.** V1 deployments remain available in the interface for viewing and claiming historical bonds only.

**How a bond is created**

The interface may require an ERC-20 Approve transaction for WBTC (Buy) or PRANA (Sell), then a separate create-bond transaction after an in-app review. One button click does not open Approve and Create wallet prompts back-to-back. If allowance is already sufficient for the intended action, Approve may be skipped.

When a create transaction succeeds:

- the selected input token amount is transferred to the matching Bond contract
- the bond’s term, rate/duration snapshot, and payout are recorded on-chain
- payout vests over time and must be claimed under the contract rules

**Buy input modes and missing slip locks**

Buy Bond supports exact WBTC input and target PRANA input. Exact WBTC uses a fixed WBTC amount. Target PRANA uses a fixed PRANA target and does **not** accept an on-chain maximum WBTC input (`maxWbtcIn`). Exact WBTC Buy and exact PRANA Sell likewise have no on-chain minimum output (`minPranaOut` / `minWbtcOut`).

Displayed quotes are estimates from public chain state and the contract’s integer math, including a 1% fee path. Final amounts can differ if reserves, rates, treasury capacity, or related state change between quote and execution. The interface may refresh the quote and set a WBTC allowance cap for Target PRANA Buy, but an allowance is not the same as an on-chain `maxWbtcIn` parameter.

**Claim and vesting**

Bond payout vests from creation time. Claimable amounts are based on cumulative vested payout minus already claimed amounts. `lastClaimTime` only helps prevent two claims at the same timestamp; it does not restart vesting the way Staking interest can accrue from the last claim.

A claim may fail if the relevant deployment is paused, treasury or reserves are insufficient, the network or RPC is unavailable, or a contract call otherwise reverts. THĐP does not guarantee that every expected payout will be available or successfully claimed.

**Configurable and administrative controls**

Bond contracts include admin and manager-controlled functions. To the extent permitted by the deployed code, those roles can pause actions, update rates and minimums, sync or set impacted reserves, and withdraw surplus under the contract rules. Existing bond records keep the payout terms stored at creation; global config changes mainly affect later actions and new bonds. Pause status, funding, and role keys remain additional risks.

## 8. Contract addresses to verify

The current official interfaces identify these Polygon contracts:

- **PRANA token:** [0x928277e774F34272717EADFafC3fd802dAfBD0F5](https://polygonscan.com/address/0x928277e774f34272717eadfafc3fd802dafbd0f5)
- **Uniswap SwapRouter02:** [0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45](https://polygonscan.com/address/0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45)
- **PRANA Staking Contract:** [0x714425A4F4d624ef83fEff810a0EEC30B0847868](https://polygonscan.com/address/0x714425a4f4d624ef83feff810a0eec30b0847868)
- **PRANA Interest Contract:** [0x1DE1E9BEF781fb3440C2c22E8ca1bF61BD26f69d](https://polygonscan.com/address/0x1de1e9bef781fb3440c2c22e8ca1bf61bd26f69d)
- **Buy Bond V1:** [0xA3adf8952982Eac60C0E43d6F93C66E7363c6Fe2](https://polygonscan.com/address/0xa3adf8952982eac60c0e43d6f93c66e7363c6fe2)
- **Buy Bond V2:** [0x431030E3A0703f0914bE26026ffDaD693F3a16cf](https://polygonscan.com/address/0x431030e3a0703f0914be26026ffdad693f3a16cf)
- **Sell Bond V1:** [0x2A48215e134a9382e1eBAf96F2Fa47Ca1c2fa092](https://polygonscan.com/address/0x2a48215e134a9382e1ebaf96f2fa47ca1c2fa092)
- **Sell Bond V2:** [0xA6aa0662f5A37ec6E86b3390C46B6eba21a31f71](https://polygonscan.com/address/0xa6aa0662f5a37ec6e86b3390c46b6eba21a31f71)

For a Swap ERC-20 approval, the transaction `to` may be the token contract; the **spender** must be SwapRouter02. For the Swap itself, the transaction `to` must be SwapRouter02.

For a PRANA Permit used by Staking, the verifying token must be the PRANA token, the spender must be the Staking Contract, and the value must be the intended stake amount. The subsequent Stake, Claim, Unstake, or Early Unstake transaction must interact with the Staking Contract.

For Bonding Approves, the spender must be the matching Buy or Sell Bond V2 contract for new creates (or the correct V1/V2 deployment when claiming). Create and claim transactions must interact with that same mapped Bond contract.

Always compare addresses character by character. If your wallet shows an unexpected chain, token, spender, contract, amount, or function, stop and reject the request.

## 9. User responsibilities

Before signing or submitting any action, you are responsible for:

- confirming that you are on the official website domain
- using Polygon mainnet and a compatible wallet
- verifying the relevant contract, token, spender, function, amount, and recipient
- reviewing gas, minimum received, price impact, duration, APR, bond term, maturity, grace period, and penalty information that applies to the action
- keeping enough POL for all required transactions, including later claims, unstaking, or bond claims
- protecting your device, wallet, private keys, seed phrase, and recovery methods
- independently checking on-chain status if the interface is delayed or unavailable
- understanding the tax and legal consequences of your transactions

Never share your seed phrase or private key with THĐP or anyone claiming to provide PRANA support. THĐP does not need either one to assist with a public transaction.

## 10. Third-party services and public blockchain data

The PRANA Interfaces depend on Polygon, Uniswap, wallets, RPC providers, hosting providers, and other third-party systems. THĐP does not own or control all of these systems and is not responsible for their availability, security, accuracy, or terms.

Blockchain transactions and wallet activity are public. Wallet addresses, token amounts, contract interactions, transaction hashes, and timestamps may be permanently visible and may be analyzed or linked with other information by third parties.

## 11. Privacy

Technical data may be processed when you visit the website or use a PRANA Interface, including operational and infrastructure logs, wallet addresses included in requests, Swap quote and transaction data, Staking account-read data, and Bonding account, quote, and transaction-confirmation requests.

See the [Privacy Policy](/privacy) for details.

## 12. No uptime or continued-feature guarantee

The website and PRANA Interfaces are provided on an “as is” and “as available” basis. THĐP does not guarantee continuous operation, error-free data, compatibility with every wallet or device, continued support for any asset or feature, or uninterrupted access to any smart contract.

An interface may be changed, paused, restricted, or discontinued. Discontinuing the website does not remove public smart contracts or blockchain records, but it may require you to use another compatible tool to interact with them.

## 13. Limitation of liability

To the maximum extent permitted by applicable law, THĐP and related parties are not liable for losses or damages arising from use of, or inability to use, the website or PRANA Interfaces, including losses caused by:

- price changes, slippage, insufficient liquidity, or failed transactions
- smart contracts, tokens, wallets, signatures, approvals, or user error
- staking lockups, penalties, expired claim periods, or unavailable interest
- bonding vesting schedules, paused deployments, reserve or treasury shortfalls, or quote differences at execution
- Polygon, Uniswap, RPC, hosting, or other third-party failures
- inaccurate, delayed, cached, or unavailable interface data
- phishing, malware, compromised devices, or unauthorized wallet access

This section does not exclude or limit liability that applicable law does not permit to be excluded or limited.

## 14. Changes to these terms

THĐP may update this document to reflect product, technical, operational, or legal changes. The version published on the official website at `/terms` is the current version.

Continued use of the website or a PRANA Interface after an update means you accept the revised version, to the extent permitted by applicable law.

## 15. Contact

Questions about these terms may be sent to [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net).
