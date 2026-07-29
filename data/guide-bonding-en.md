# PRANA Bonding Guide

This guide covers the main wallet prompts and bond actions on **PRANA Bonding** at [/bond/](/bond/). Read it with the [Terms & Risk Disclosure](/terms).

Bonding runs on **Polygon mainnet**. Keep some **POL** for gas. New bonds are created only on the **V2** contracts. Older **V1** bonds remain visible so you can track vesting and claim — you cannot open new V1 bonds in this interface.

## 1. Approve before create

Creating a bond often needs an ERC-20 **Approve** first:

- **Buy Bond** spends **WBTC** — approve the Buy Bond V2 contract as spender
- **Sell Bond** spends **PRANA** — approve the Sell Bond V2 contract as spender

The primary button follows phases: **Approve** → **Review** → **Create Bond** → **Confirming**. One click never opens Approve and Create prompts back-to-back. If allowance already matches the required amount, the UI skips Approve and goes straight to Review.

What to check on the Approve prompt:

- token is **WBTC** (Buy) or **PRANA** (Sell)
- spender is the matching **V2** bond contract
- amount or spending cap matches what the interface shows
- chain is **Polygon**

Reject the request if any detail is unexpected.

## 2. Buy Bond — exact WBTC

Buy Bond locks **WBTC** and vest **PRANA** over the selected term.

You enter how much WBTC to spend. The quote shows expected PRANA payout. The contract call uses that exact WBTC amount (`buyBondForWbtcAmount`). There is no `minPranaOut`, so the PRANA you receive can differ if reserves or rates change before the transaction executes.

Before create, the app refreshes the quote. If raw amounts are unchanged, the flow continues; if they changed, Review updates before you can write.

## 3. Sell Bond

Sell Bond locks **PRANA** and vest **WBTC** over the selected term.

You always enter an exact PRANA amount. The quote shows expected WBTC payout. The contract call is `sellBond(pranaAmount, period)`. There is no `minWbtcOut`, so the WBTC you receive can differ if on-chain state changes between quote and execution.

Allowance must be at least the exact PRANA input. Use MAX for Buy WBTC and Sell PRANA.

## 4. Vesting and claim

Each active bond shows principal, total payout, claimed amount, claimable amount, and vesting progress.

Claimable math (same idea as the contracts):

- Before maturity: vested total grows from `creationTime` to `maturityTime`, then claimable is vested total minus already claimed
- From maturity: you can claim the full remaining payout; the contract marks the bond claimed when nothing is left
- `lastClaimTime` only blocks two claims in the same block timestamp — it is **not** the start of a new vesting window

To claim:

1. Connect the wallet that owns the bond
2. Open the bond card under **Active bonds**
3. Review claimable amount and progress
4. Tap **Claim** and confirm the transaction

Claim is a separate on-chain transaction and costs gas. The UI picks the correct V1/V2 Buy or Sell contract from an internal mapping — do not trust a forged address in any API payload. If that deployment is paused, claim is disabled with a clear reason.

## 5. Treasury, pause, and quote limits

Quotes can be non-executable even when the form looks filled. Common issues:

- contract **paused**
- amount below the on-chain **minimum**
- payout would exceed available **reserves**
- treasury cannot cover the committed payout

Quotes include a **1% fee** in the math (same as the contracts). Term rate and duration come from on-chain `bondRates`. Quotes are computed at the block the server read; time alone does not change a quote if reserves, rates, and treasury are unchanged. The UI still refreshes before write because the contracts do not lock a minimum output or maximum input.

Displayed quotes are estimates. Final on-chain amounts may differ if state changes between quote and confirmation.

For how BuyPranaBondV2 and SellPranaBondV2 work (manager powers and limits), see the [Contract explanation](/guide/bonding-contracts/). For addresses and full risk language, see the [Terms & Risk Disclosure](/terms).
