# PRANA Staking Guide

This guide covers the main wallet prompts and stake actions on **PRANA Staking** at [/stake/](/stake/). Read it with the [Terms & Risk Disclosure](/terms).

Staking runs on **Polygon mainnet**. Keep some **POL** for gas. Your PRANA stays in your wallet until a stake transaction succeeds; after that, the staked principal is held by the Staking Contract under its rules.

## 1. Two wallet prompts for Permit & Stake

The primary button is **Permit & Stake**. One click can open **two** wallet prompts:

1. **Permit (signature)** — off-chain EIP-2612 authorization for the exact PRANA amount
2. **Stake (transaction)** — on-chain `stakeWithPermit` that moves PRANA into the Staking Contract

What to check on the Permit prompt:

- token is **PRANA**
- spender is the **Staking Contract**
- amount matches the stake you entered
- chain is **Polygon**
- deadline / nonce look expected

Reject the signature if any detail is wrong.

What to check on the Stake prompt:

- you are interacting with the **Staking Contract**
- the amount and duration match what you selected
- gas and network are acceptable

If you signed Permit but rejected or failed the Stake transaction, a valid Permit may still be reusable. The button can change to **Continue Stake** so you do not need to sign Permit again until it expires or becomes invalid.

While waiting, the UI may show signing, submitting, or confirming states. A broadcast stake that is still unconfirmed is a pending transaction — wait or resume confirmation instead of opening duplicate writes.

## 2. How to claim

Each active stake can accrue PRANA-denominated interest under the contract rules.

To claim:

1. Connect the same wallet that created the stake
2. Find the stake card under **Active stakes**
3. Review accrued interest
4. Tap **Claim interest** and confirm the transaction in your wallet

Claim is a separate on-chain transaction and costs gas. Interest is paid from the Interest Contract. A claim can fail if the contract is paused, funding is insufficient, the network is unavailable, or the call reverts for another reason.

Displayed accrued interest is an estimate from public contract data and integer rounding. The final on-chain amount may differ slightly.

You can claim eligible interest while the stake is active, and after maturity only until the grace period ends.

## 3. Maturity and grace period

**Maturity** is when the chosen stake duration ends. At maturity, the principal becomes eligible to unstake under the contract rules, and remaining claimable interest is still subject to the grace window.

**Grace period** is the limited time after maturity when you can still claim remaining eligible interest. After the grace period ends:

- unclaimed interest can no longer be claimed
- principal may still be eligible to unstake

Monitor maturity yourself. The interface shows status labels such as active, matured, claim-first, or grace expired. Do not rely only on screenshots or old announcements for current grace settings — values are read from the chain and can change for future stakes or global config.

## 4. Unstake

**Unstake** returns the staked principal after maturity.

Important rule in the official UI:

- if a matured stake still has claimable interest during the grace period, you must **claim first**
- if you unstake before claiming, the stake record is removed and unclaimed interest may be lost

After a successful unstake:

- principal returns to your wallet (minus gas paid for the transaction)
- that stake card is removed from the active list

Unstake is an on-chain transaction. Confirm you are interacting with the Staking Contract before signing.

## 5. Early unstake

**Early unstake** lets you exit before maturity, with contract penalties:

- a configured **early-unstake penalty** is deducted from principal
- **all accrued but unclaimed interest** for that stake is lost
- the penalty is transferred by the Staking Contract to the Interest Contract
- you also pay Polygon gas

The official UI shows a confirmation dialog with the penalty percent, estimated return, and the interest-lost warning. Review those numbers before confirming.

Early-unstake penalty is a smart-contract rule, not a separate interface fee charged by THĐP. Current percentages can change through contract configuration for future actions; always trust the values shown at confirmation time.

For contract addresses, APR meaning, and full risk language, see the [Terms & Risk Disclosure](/terms).
