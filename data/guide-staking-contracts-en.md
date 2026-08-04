# Contract Explanation

This page explains how the two on-chain contracts behind **PRANA Staking** work: the **Staking Contract** and the **Interest Contract**. Read it with the [Staking guide](/guide/staking/) and the [Terms & Risk Disclosure](/terms).

Both contracts run on **Polygon**. Addresses are shown on [/stake/](/stake/) and on Polygonscan. This page is educational — always verify the live contract code and parameters on-chain before staking.

## 1. Big picture

Staking uses **two contracts** with separate jobs:

- **Staking Contract** — holds each user’s staked PRANA (principal), records stake terms, and handles stake / claim / unstake logic
- **Interest Contract** — holds the PRANA reserved to pay interest, and only the Staking Contract may call it to pay users

Your principal and the interest budget are **not** in the same contract. Interest is paid from the Interest Contract; principal returns from the Staking Contract when you unstake.

Typical lifecycle:

1. You stake PRANA into the Staking Contract (via Permit + `stakeWithPermit`)
2. Interest accrues by time and the APR locked into that stake
3. You claim interest (Staking Contract asks Interest Contract to transfer PRANA to you)
4. After maturity you unstake to recover principal — or you exit early with a penalty

## 2. Staking Contract — what it does

Each stake stores its own snapshot:

- stake id
- principal amount
- start time and duration
- **APR at stake time** (later APR config changes do not rewrite this stake)
- last claim time

What you can do as a staker:

- **Stake** — move PRANA into the contract for an allowed duration (minimum amount and valid duration required; contract may be paused)
- **Claim interest** — receive accrued PRANA interest while the claim window is open (from stake start until maturity + grace period)
- **Unstake** — after maturity, get the full principal back
- **Unstake early** — before maturity, get principal minus the early-unstake penalty; accrued interest on that stake is not paid out

Other important rules:

- Interest math uses integer division on-chain (per-second accrual from annual interest). Displayed UI estimates can differ slightly from the final on-chain amount.
- After maturity, remaining claimable interest is only available until the **grace period** ends — the extra window after maturity during which you can still claim leftover interest. Grace length comes from on-chain config (the owner can change it; it is not a fixed constant). On [/stake/](/stake/), when a stake has matured and is still inside the grace window, the stake card shows a countdown of remaining grace time. After that, unclaimed interest can no longer be claimed; principal may still be unstaked.
- Early-unstake penalty PRANA is sent to the Interest Contract (it can later fund interest payments).
- While the contract is **paused**, stake / claim / unstake calls that use `whenNotPaused` are blocked.

## 3. Interest Contract — what it does

The Interest Contract is a funding vault for staking rewards:

- It holds PRANA that the PRANA Protocol deposits to cover interest
- Only the configured **Staking Contract** can call `payInterest` to send PRANA to a user
- The Staking Contract address can be set by the owner **only once** (`stakingContractSet` becomes true and cannot be changed in the current code)

So interest payouts are not a free “owner send to anyone” path — payouts go through staking claim logic.

## 4. What the owner (PRANA Protocol) can do

Owner here means the on-chain `Ownable` owner of each contract (PRANA Protocol / the address currently set as owner). Ownership can also be transferred with OpenZeppelin `Ownable` helpers.

On the **Staking Contract**, the owner can:

- **Pause / unpause** staking actions (`setPaused`)
- **Update APR** for configured durations (new stakes use the new APR; existing stakes keep their stored APR)
- **Change minimum stake** amount
- **Change grace period** after maturity
- **Change early-unstake penalty** (capped at 20% in the current contract)
- **Rescue non-PRANA tokens** accidentally sent to the Staking Contract
- Transfer ownership

On the **Interest Contract**, the owner can:

- **Set the Staking Contract address once** after deploy
- **Withdraw excess PRANA** only above what `totalInterestNeeded()` still reserves for active / claimable stakes
- Transfer ownership

These admin levers are real operational powers. Pause especially can temporarily block user actions until unpaused.

## 5. What the owner cannot do (with current contract code)

With the contracts as written, the owner **cannot**:

- Directly withdraw users’ **staked PRANA** from the Staking Contract — `rescueToken` explicitly forbids rescuing the PRANA token
- Rewrite the APR or principal of an **already-created** stake record
- Point the Interest Contract at a different Staking Contract after it has been set
- Drain Interest Contract PRANA that is still required by `totalInterestNeeded()` — only the surplus above that reserve is withdrawable
- Call `payInterest` as owner — only the Staking Contract may pay interest
- Seize or reassign another user’s stake ids / balances through an admin transfer function (there is none)

Important nuance: “cannot steal principal via a withdraw function” is **not** the same as “no admin risk.” Pause, parameter changes, ownership transfer, Interest Contract funding levels, and smart-contract / chain risk still matter. Always read the [Terms & Risk Disclosure](/terms).

## 6. Practical checklist before you stake

- Confirm you are on **Polygon** and interacting with the official Staking / Interest addresses linked from [/stake/](/stake/)
- Understand that APR is fixed **per stake at creation**, while global config (min stake, grace, penalty, pause, published APRs for new stakes) can still change
- Plan to claim before the grace window ends if you want remaining interest after maturity — watch the grace countdown on the stake card at [/stake/](/stake/)
- Keep POL for gas; Permit is a signature, Stake / Claim / Unstake are on-chain transactions
- Treat Interest Contract balance / funding as an operational dependency for successful claims

For step-by-step wallet prompts, see the [Staking guide](/guide/staking/).
