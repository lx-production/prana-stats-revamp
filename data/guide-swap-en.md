# PRANA Swap Guide

This short guide explains the wallet steps and on-screen numbers you will see when using **PRANA Swap** on the official website. Read it with the [Terms & Risk Disclosure](/terms).

PRANA Swap runs on **Polygon mainnet**. Keep some **POL** for gas. Connect only on the official domain, and compare contract addresses carefully before confirming.

## 1. Approve

When you swap an **ERC-20** token (for example USDC, USDT, or PRANA), the Uniswap router needs permission to pull that token from your wallet. That permission is an **approve** transaction.

Typical flow:

1. You enter an amount and review the quote
2. If allowance is too low, your wallet asks you to **Approve** first
3. After approval confirms, the wallet asks you to confirm the **Swap**

On the approve screen, check:

- the **token** being approved
- the **amount**
- the **spender** (must be Uniswap SwapRouter02)

**Native POL** swaps skip ERC-20 approve. You only confirm the swap itself.

Approve is a separate on-chain transaction and costs gas. A cancelled or failed approve does not move your tokens, but you still may pay gas.

## 2. Exact allowance

PRANA Swap requests approval for the **exact input amount** of the current quote, not an unlimited allowance.

Examples:

- Swap 100 USDC → approve 100 USDC
- Swap 50 PRANA → approve 50 PRANA

If you change the swap amount, you may need to approve again. Exact allowance limits how much the router can spend for that swap.

Important:

- A successful swap consumes the approved amount
- If a swap is cancelled, fails, or only partly uses the allowance, some allowance can remain on-chain
- Remaining allowance is not the same as the router holding your tokens; it is a spending permission you can revoke later

## 3. Slippage

**Slippage** is the difference between the quoted output and the final on-chain output when prices move while your transaction is pending.

PRANA Swap currently uses a **fixed 0.5%** slippage setting in the interface. You cannot change it in the current UI.

If the market moves more than that tolerance before confirmation, the swap can **revert** instead of filling at a worse rate. Reverts still consume gas.

Slippage protection mainly matters when pools move between quote time and confirmation. Price impact from your own trade size is already reflected in the quote.

## 4. Minimum received

**Minimum received** is the lowest output amount the swap is allowed to deliver on-chain.

It is derived from the quoted output minus the fixed slippage tolerance (quote × 99.5% at 0.5% slippage).

If execution would deliver less than this number, the transaction reverts. Review **Minimum received** together with the route and gas estimate before you confirm.

Quotes are estimates. The final received amount can be higher than the minimum, but it will not go below it unless the transaction fails.

## 5. Transaction pending

After you confirm in your wallet, the status can show pending or confirming stages, for example:

- **Approve in Wallet** / **Confirming Approval**
- **Swap in Wallet** / **Confirming Swap**

While a transaction is pending:

- wait for the wallet and network to finish; do not spam duplicate confirms
- you can open the transaction on Polygonscan from the success or pending UI when a hash is shown
- confirmation time depends on Polygon congestion and your gas settings
- closing the modal does not cancel an already-broadcast transaction

If the UI says the transaction is pending but your wallet already shows success or failure, refresh balances and check Polygonscan with the transaction hash.

## 6. Revoke allowance

PRANA Swap does not currently include a built-in **Revoke** button. You are responsible for reviewing leftover ERC-20 allowances after cancelled or failed swaps.

Before revoking, confirm the spender is the official Uniswap SwapRouter02 on Polygon:

[0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45](https://polygonscan.com/address/0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45)

Common options:

- use your wallet’s token-allowance / spending-cap controls, if available
- use a reputable allowance checker and revoke tool that supports Polygon
- on Polygonscan, open the token contract → **Write Contract** → `approve(spender, 0)` for SwapRouter02

Revoking sets the allowance to zero (or another safe value you choose). It requires a wallet signature and gas. Never share your seed phrase or private key to “revoke for you.”

For risks, contract addresses, and legal terms, see the [Terms & Risk Disclosure](/terms).
