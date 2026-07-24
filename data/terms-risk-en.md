# Terms & Risk Disclosure

This document applies to the official PRANA Protocol website and its transaction interfaces, including **PRANA Swap** and **PRANA Staking** (together, the **PRANA Interfaces**). Please read it carefully before connecting a wallet, signing a message, or confirming a transaction.

By using a PRANA Interface, you acknowledge that you understand and accept these terms and the risks described below. If you do not agree, do not use the PRANA Interfaces.

## 1. Nature of the PRANA Interfaces

The PRANA Interfaces are technical, non-custodial interfaces that help users interact with public smart contracts on the Polygon blockchain.

Triết Học Đường Phố (**THĐP**):

- does not create an internal trading or staking account for you
- does not control your wallet, private keys, or seed phrase
- cannot sign transactions for you
- cannot reverse, cancel, or recover a transaction after it is confirmed on-chain

You remain in control of your wallet. However, when you stake PRANA, the staked principal is transferred from your wallet to the Staking Contract and is then governed by that contract until it is returned under the contract rules.

Smart contracts are not the same as a bank account or a custodial account. Assets held by a smart contract may be exposed to contract, blockchain, configuration, and operational risks.

## 2. Eligibility and lawful use

You must have full legal capacity under applicable law and be of sufficient age to enter into transactions on your own. You may not use a PRANA Interface on behalf of another person without lawful authority.

You are responsible for determining whether your use of PRANA, swaps, staking, and the PRANA Interfaces is lawful in your nationality, residence, and jurisdiction.

**Do not use a PRANA Interface** if your use is restricted or prohibited by applicable law.

## 3. No investment, legal, or tax advice

Information on the website, in product announcements, and in the PRANA Interfaces is provided only to describe PRANA Protocol, its public data, and the available technical interactions.

This information is **not**:

- investment or financial advice
- legal advice
- tax advice
- a recommendation or guarantee for any person

You alone are responsible for deciding whether to buy, sell, hold, swap, stake, claim, or unstake digital assets. You should obtain independent professional advice where appropriate.

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

PRANA Staking helps users create and manage PRANA stakes through the Staking Contract on Polygon.

**How a stake is created**

The interface uses an EIP-2612 Permit signature for the exact PRANA amount and then submits a `stakeWithPermit` transaction. The Permit signature is off-chain, but the Stake transaction is on-chain and requires a separate wallet confirmation. A single “Permit & Stake” button may therefore trigger two wallet prompts.

When the Stake transaction succeeds:

- the selected PRANA principal is transferred to the Staking Contract
- the duration and APR for that stake are recorded on-chain
- the principal is locked until maturity unless you use early unstake

A Permit signature is an authorization. Read the spender, token, amount, chain, nonce, and deadline displayed by your wallet before signing. Reject the signature if any detail is unexpected.

**APR and interest**

APR is an annualized rate used by the contract to calculate PRANA-denominated interest. It is not a guarantee of fiat value, market return, purchasing power, or profit.

Displayed projected or accrued interest is an estimate based on public contract data and the contract’s integer-rounding formula. The final on-chain amount may differ slightly because of block timestamps, integer rounding, configuration changes, or stale interface data.

Interest payments depend on the Interest Contract having enough PRANA and functioning as expected. A claim may fail if the contract is paused, the Interest Contract is insufficiently funded, the network or RPC is unavailable, or a contract call otherwise reverts. THĐP does not guarantee that every expected interest payment will be available or successfully paid.

**Claim, maturity, and grace period**

Interest accrues only under the Staking Contract’s rules. You may claim eligible interest while a stake is active and, after maturity, only until the applicable grace period ends.

If you unstake a matured position before claiming its remaining eligible interest, the stake record is removed and that unclaimed interest may be lost. The official interface therefore requires you to claim eligible interest before unstaking during the grace period.

After the grace period ends, unclaimed interest can no longer be claimed, although the principal may still be eligible for unstaking under the contract rules. You are responsible for monitoring maturity and claiming in time.

**Early unstake**

Early unstake returns less than the original principal:

- the configured early-unstake penalty is deducted from principal
- all accrued but unclaimed interest for that stake is lost
- the penalty is transferred by the Staking Contract to the Interest Contract
- you also pay Polygon gas

The early-unstake penalty is a smart-contract rule, not a separate interface fee charged by THĐP. Review the currently displayed percentage and estimated return before confirming.

**Configurable and administrative controls**

The Staking Contract includes owner-controlled functions. To the extent permitted by the deployed contract, its owner can pause contract actions and change available APRs, the minimum stake, the grace period, and the early-unstake penalty.

The APR stored for an existing stake is set when that stake is created. Other global settings and paused status may affect actions taken later. Current values shown in the interface are read from the blockchain and may change; do not rely on older screenshots, announcements, or cached values.

Administrative keys, contract ownership, configuration changes, and the availability of the Interest Contract are additional risks. Review current on-chain state before acting.

## 7. Contract addresses to verify

The current official interfaces identify these Polygon contracts:

- **PRANA token:** [0x928277e774F34272717EADFafC3fd802dAfBD0F5](https://polygonscan.com/address/0x928277e774f34272717eadfafc3fd802dafbd0f5)
- **Uniswap SwapRouter02:** [0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45](https://polygonscan.com/address/0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45)
- **PRANA Staking Contract:** [0x714425A4F4d624ef83fEff810a0EEC30B0847868](https://polygonscan.com/address/0x714425a4f4d624ef83feff810a0eec30b0847868)
- **PRANA Interest Contract:** [0x1DE1E9BEF781fb3440C2c22E8ca1bF61BD26f69d](https://polygonscan.com/address/0x1de1e9bef781fb3440c2c22e8ca1bf61bd26f69d)

For a Swap ERC-20 approval, the transaction `to` may be the token contract; the **spender** must be SwapRouter02. For the Swap itself, the transaction `to` must be SwapRouter02.

For a PRANA Permit used by Staking, the verifying token must be the PRANA token, the spender must be the Staking Contract, and the value must be the intended stake amount. The subsequent Stake, Claim, Unstake, or Early Unstake transaction must interact with the Staking Contract.

Always compare addresses character by character. If your wallet shows an unexpected chain, token, spender, contract, amount, or function, stop and reject the request.

## 8. User responsibilities

Before signing or submitting any action, you are responsible for:

- confirming that you are on the official website domain
- using Polygon mainnet and a compatible wallet
- verifying the relevant contract, token, spender, function, amount, and recipient
- reviewing gas, minimum received, price impact, duration, APR, maturity, grace period, and penalty information that applies to the action
- keeping enough POL for all required transactions, including later claims or unstaking
- protecting your device, wallet, private keys, seed phrase, and recovery methods
- independently checking on-chain status if the interface is delayed or unavailable
- understanding the tax and legal consequences of your transactions

Never share your seed phrase or private key with THĐP or anyone claiming to provide PRANA support. THĐP does not need either one to assist with a public transaction.

## 9. Third-party services and public blockchain data

The PRANA Interfaces depend on Polygon, Uniswap, wallets, RPC providers, hosting providers, and other third-party systems. THĐP does not own or control all of these systems and is not responsible for their availability, security, accuracy, or terms.

Blockchain transactions and wallet activity are public. Wallet addresses, token amounts, contract interactions, transaction hashes, and timestamps may be permanently visible and may be analyzed or linked with other information by third parties.

## 10. Privacy

Technical data may be processed when you visit the website or use a PRANA Interface, including operational and infrastructure logs, wallet addresses included in requests, Swap quote and transaction data, and Staking account-read data.

See the [Privacy Policy](/privacy) for details.

## 11. No uptime or continued-feature guarantee

The website and PRANA Interfaces are provided on an “as is” and “as available” basis. THĐP does not guarantee continuous operation, error-free data, compatibility with every wallet or device, continued support for any asset or feature, or uninterrupted access to any smart contract.

An interface may be changed, paused, restricted, or discontinued. Discontinuing the website does not remove public smart contracts or blockchain records, but it may require you to use another compatible tool to interact with them.

## 12. Limitation of liability

To the maximum extent permitted by applicable law, THĐP and related parties are not liable for losses or damages arising from use of, or inability to use, the website or PRANA Interfaces, including losses caused by:

- price changes, slippage, insufficient liquidity, or failed transactions
- smart contracts, tokens, wallets, signatures, approvals, or user error
- staking lockups, penalties, expired claim periods, or unavailable interest
- Polygon, Uniswap, RPC, hosting, or other third-party failures
- inaccurate, delayed, cached, or unavailable interface data
- phishing, malware, compromised devices, or unauthorized wallet access

This section does not exclude or limit liability that applicable law does not permit to be excluded or limited.

## 13. Changes to these terms

THĐP may update this document to reflect product, technical, operational, or legal changes. The version published on the official website at `/terms` is the current version.

Continued use of the website or a PRANA Interface after an update means you accept the revised version, to the extent permitted by applicable law.

## 14. Contact

Questions about these terms may be sent to [thdp@triethocduongpho.net](mailto:thdp@triethocduongpho.net).
