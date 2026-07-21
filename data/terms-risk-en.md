# Terms & Risk Disclosure

This document applies to the official PRANA Protocol website and the **PRANA Swap** interface. Please read it carefully before connecting a wallet or confirming any transaction.

## 1. Nature of the product

PRANA Swap is a **non-custodial** technical interface that helps users interact with public smart contracts on the Polygon blockchain.

PRANA Swap does not create internal trading accounts or custodial balances for users.

Triết Học Đường Phố (**THĐP**):

- does not custody user assets
- does not control private keys or seed phrases
- cannot reverse transactions once they are confirmed on-chain

Tokens remain in a wallet you control until you personally sign and submit a transaction.

## 2. Eligibility

Users must have full legal capacity under applicable law and be of sufficient age to enter into transactions on their own. You may not use PRANA Swap on behalf of another person without lawful authority.

## 3. No investment advice

Information on the website, in product announcements, and in the PRANA Swap interface is provided only to describe the technology and how to use the product.

This content is **not**:

- investment advice
- legal advice
- tax advice
- a personalized financial recommendation for any individual

You alone are responsible for every decision to buy, sell, hold, or swap assets.

## 4. Key risks

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

## 5. User responsibilities

Before using the product, you are responsible for:

- assessing whether the risks are appropriate for your circumstances
- reviewing all transaction details in your wallet before signing (tokens, amounts, contract addresses, network)
- confirming you are on the official website domain before connecting a wallet
- determining whether using PRANA Swap is lawful for your nationality, residence, and jurisdiction

**Do not use PRANA Swap** if doing so is restricted or prohibited under applicable law for you.

## 6. Smart-contract address to verify

PRANA Swap uses **Uniswap SwapRouter02** on Polygon as the execution router for swaps:

[0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45](https://polygonscan.com/address/0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45#tokentxns)

What to verify in your wallet differs between the two steps:

- **Approve (ERC-20):** technically, the transaction `to` is the **token contract** you are approving (for example USDC or PRANA), not SwapRouter02. On its confirmation screen, a wallet may emphasize or show only the token, amount, and **spender**/“Approve to”; the technical `to` may be absent or available only in transaction details. The address to verify is the **spender** in the `approve` call — it must exactly match SwapRouter02 above. If the wallet shows `to` or “Interacting with” for an approval, that can be the token contract, not the router.

- **Swap:** the transaction `to` must be SwapRouter02 above.

If your wallet shows a different spender (on approve) or `to` (on swap) than the address above, stop and do not confirm the transaction.

## 7. Exact-amount approvals

For ERC-20 tokens, an **approve** step is required before a swap if the current allowance is insufficient.

PRANA Swap requests approval for the **exact amount** of the current trade (not an unlimited approval):

- Swap 100 USDC → approve 100 USDC
- Swap 50 PRANA → approve 50 PRANA

If the swap amount changes, you may need to approve again. This approach limits spending permission to each trade.

For native **POL** on Polygon, no ERC-20 approve is required; the swap needs only one wallet confirmation.

If a swap fails, is cancelled, or does not fully use the approved allowance, the approved spending permission may still remain on-chain. Users can check and revoke that allowance with an appropriate tool when needed.

## 8. Fees and costs

PRANA Swap does **not** charge a separate interface fee or routing fee.

You may still pay ordinary on-chain costs, for example:

- Polygon network gas
- liquidity-provider (LP) fees of the Uniswap pools used
- price impact when trade size is large relative to available liquidity

The WBTC/PRANA pool currently uses a **1%** LP fee. THĐP has provided liquidity for this pool since the early PRANA ecosystem; that fact does not remove liquidity or price risk.

A trade may be routed through multiple pools. In that case, the quoted rate already reflects the combined effect of those pools and their corresponding liquidity fees. Price impact and slippage are not fees charged by THĐP.

## 9. Current technical scope

In the current version, PRANA Swap:

- works on **Polygon mainnet** only
- supports a fixed allowlist of 7 tokens: **PRANA, WBTC, POL, USDC, USDT, WETH, DAI**
- uses a fixed **0.5%** slippage setting in the interface
- sends transactions through Uniswap SwapRouter02 as described in section 6
- requires an injected wallet (for example MetaMask or Rabby); you must sign every transaction yourself

Users may swap between any tokens in the list; PRANA does not have to be part of the pair.

## 10. Third-party services

PRANA Swap depends on Polygon, Uniswap, wallets, RPC providers, and other third-party infrastructure. THĐP does not own or control all of these systems. Using them may also be subject to each provider’s own terms.

## 11. Data and privacy

Details about technical data that may be processed when you use the website or PRANA Swap (for example operational logs, wallet addresses in quote/swap requests, and infrastructure access logs) are described in the [Privacy Policy](/privacy).

## 12. No uptime guarantee and limitation of liability

PRANA Swap is provided on an “as is” and “as available” basis, without any guarantee of continuous operation, freedom from errors, or compatibility with every wallet and device.

To the maximum extent permitted by applicable law, THĐP and related parties are not liable for damages arising from use of, or inability to use, PRANA Swap, including blockchain failures, third-party smart contracts, wallets, RPCs, quote data, or transactions signed by the user.

This section does not exclude or limit any liability that applicable law does not allow to be excluded or limited.

## 13. Updates to these terms

THĐP may update this document over time to reflect product changes or legal requirements. The version published on the official website at `/terms` is the current version.

Continued use of the website or PRANA Swap after an update means you accept the revised version, to the extent permitted by applicable law.

## 14. Practical checklist before using the product

Before each transaction:

1. Confirm you are on the official website domain
2. Confirm your wallet is on Polygon
3. Verify the correct address from section 6: spender/“Approve to” on approve, `to` on swap
4. Carefully read token-in / token-out amounts and the minimum received amount in your wallet
5. Confirm only if you understand and accept the risks

If you do not agree with these terms and risks, do not connect a wallet and do not use PRANA Swap.
