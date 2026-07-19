# Terms & Risk Disclosure

This document applies to the official PRANA Protocol website and the **PRANA Swap** interface. Please read it carefully before connecting a wallet or confirming any transaction.

## 1. Nature of the product

PRANA Swap is a **non-custodial** technical interface that helps users interact with public smart contracts on the Polygon blockchain.

Triết Học Đường Phố (**THĐP**):

- does not custody user assets
- does not control private keys or seed phrases
- cannot reverse transactions once they are confirmed on-chain
- does not operate PRANA Swap as a centralized exchange (CEX)

Tokens remain in a wallet you control until you personally sign and submit a transaction.

## 2. No investment advice

Information on the website, in product announcements, and in the PRANA Swap interface is provided only to describe the technology and how to use the product.

This content is **not**:

- investment advice
- legal advice
- tax advice
- a personalized financial recommendation for any individual

You alone are responsible for every decision to buy, sell, hold, or swap assets.

## 3. Key risks

Digital assets and decentralized protocols can involve risks, including without limitation:

- sharp short-term price volatility
- thin or suddenly changing liquidity
- slippage and price impact
- bugs, vulnerabilities, or unexpected smart-contract behavior
- blockchain outages, congestion, or abnormal gas costs
- wallet compromise, phishing, malware, or user error
- fake tokens, spoofed contract addresses, or impersonated interfaces
- asset loss that **cannot be recovered**

There is no promise regarding price, profit, liquidity availability, or trading outcomes.

## 4. User responsibilities

Before using the product, you are responsible for:

- assessing whether the risks are appropriate for your circumstances
- reviewing all transaction details in your wallet before signing (tokens, amounts, contract addresses, network)
- confirming you are on the official website domain before connecting a wallet
- determining whether using PRANA Swap is lawful for your nationality, residence, and jurisdiction

**Do not use PRANA Swap** if doing so is restricted or prohibited under applicable law for you.

## 5. Smart-contract address to verify

When approving or swapping an ERC-20 token, your wallet will ask you to sign an interaction with **Uniswap SwapRouter02** on Polygon. This is the single address used for both the approve step (spender) and the swap step (`to`):

`0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`

If your wallet shows a different spender/`to` address, stop and do not confirm the transaction.

The server-side quote interface is not a contract that receives your tokens. Users only need to verify SwapRouter02 when signing approve and swap transactions.

## 6. Exact-amount approvals

For ERC-20 tokens, an **approve** step is required before a swap if the current allowance is insufficient.

PRANA Swap requests approval for the **exact amount** of the current trade (not an unlimited approval):

- Swap 100 USDC → approve 100 USDC
- Swap 50 PRANA → approve 50 PRANA

If the swap amount changes, you may need to approve again. This approach limits spending permission to each trade.

For native **POL** on Polygon, no ERC-20 approve is required; the swap needs only one wallet confirmation.

## 7. Fees and costs

PRANA Swap does **not** charge a separate interface fee or routing fee.

You may still pay ordinary on-chain costs, for example:

- Polygon network gas
- liquidity-provider (LP) fees of the Uniswap pools used
- price impact when trade size is large relative to available liquidity

The WBTC/PRANA pool currently uses a **1%** LP fee. THĐP has provided liquidity for this pool since the early PRANA ecosystem; that fact does not remove liquidity or price risk.

## 8. Current technical scope

In the current version, PRANA Swap:

- works on **Polygon mainnet** only
- supports a fixed allowlist of 7 tokens: **PRANA, WBTC, POL, USDC, USDT, WETH, DAI**
- uses a fixed **0.5%** slippage setting in the interface
- sends transactions through Uniswap SwapRouter02 as described in section 5
- requires an injected wallet (for example MetaMask or Rabby); you must sign every transaction yourself

Users may swap between any tokens in the list; PRANA does not have to be part of the pair.

## 9. What PRANA Swap is not

PRANA Swap is **not**:

- a centralized exchange (CEX)
- a service that requires account registration or KYC operated by THĐP
- a custodial service or wallet held by THĐP
- insurance, a profit guarantee, or a promise of price / liquidity

Every final trading decision requires your direct confirmation signature in a wallet you control.

## 10. No uptime guarantee and limitation of liability

The website, quote API, and interface may be interrupted, delayed, inaccurate in display, or changed without prior notice.

To the fullest extent permitted by applicable law, THĐP and related parties are not liable for direct or indirect damages arising from use of, or inability to use, PRANA Swap, including asset loss from on-chain transactions, network failures, wallet failures, or user decisions.

## 11. Updates to these terms

THĐP may update this document over time to reflect product changes or legal requirements. The version published on the official website at `/terms` is the current version.

Continued use of the website or PRANA Swap after an update means you accept the revised version, to the extent permitted by applicable law.

## 12. Practical checklist before using the product

Before each transaction:

1. Confirm you are on the official website domain
2. Confirm your wallet is on Polygon
3. Verify the SwapRouter02 address in section 5
4. Carefully read token-in / token-out amounts and the minimum received amount in your wallet
5. Confirm only if you understand and accept the risks

If you do not agree with these terms and risks, do not connect a wallet and do not use PRANA Swap.
