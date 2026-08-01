# Bonding Contract Explanation

This page explains the contracts on Polygon behind **PRANA Bonding**: **BuyPranaBondV2** and **SellPranaBondV2**. Read it with the [Bonding guide](/guide/bonding/) and the [Terms & Risk Disclosure](/terms).

**V1 note:** Buy/Sell Bond V1 deployments remain only for viewing and claiming historical bonds. **New bonds are created only on V2.**

## 1. Big picture

Bonding uses **two independent V2 contracts**:

- **BuyPranaBondV2** — receives **WBTC**, creates a bond that vests **PRANA**
- **SellPranaBondV2** — receives **PRANA**, creates a bond that vests **WBTC**

They do not share one vault. Each side has its own reserves accounting, minimums, terms, pause flag, and treasury commitments.

Typical lifecycle:

1. You approve the spending token for the matching V2 contract
2. You create a bond with a chosen term (`bondRates` period)
3. Payout vests over time from `creationTime` to `maturityTime`
4. You claim vested payout (partially before maturity, or the remainder from maturity)



## 2. Impacted reserves and price impact

Each V2 contract keeps two reserve sets:

- **Impacted reserves** (`impactedWbtcReserve`, `impactedPranaReserve`): internal reserves that already include the effect of previous bonds.
- **Market reserves**: live Uniswap V3 pool reserves at quote/create time.

After each bond creation, impacted reserves are updated. So the next bond sees **progressive price impact**, instead of always resetting to live pool price. This is the only difference between V1 and V2. V1 did not have **Impacted Reserves**.

**Price selection rule for quote/create:** the contract computes both paths and picks the one that **does not give users a better price than current market**.

- **Impacted is the default**.
- If impacted is better for the user than DEX market, the contract **syncs impacted to pool** and uses **market**.

This applies to both app quote modes (buy & sell PRANA) and to the on-chain create paths.

**Where is the OTC edge?** 

This guard only constrains the AMM baseline (before incentives). The OTC edge comes from `bondRates`:

- Buy can get a **discount**
- Sell can get a **premium**
- In exchange, payout **vests over the selected term**

If discount/premium plus vesting still makes bonding worse than direct DEX swap, then DEX swap is the better choice.

Technical notes:

- `calculate*Amount` view functions read impacted only (no market comparison).
- The market auto-sync branch exists in create functions (and backend quote mirrors this logic).
- `BOND_MANAGER_ROLE` (PRANA Protocol) can call `syncImpactedReserves` or `setImpactedReserves` to adjust impacted reserves (admin-only; does not change payouts of existing bonds). Frequency and timing of syncImpactedReserves are decided internally, not announced beforehand.

## 3. Buy Bond create paths

BuyPranaBondV2 exposes two create functions on-chain:

- `buyBondForWbtcAmount(wbtcAmount, period)` — spend an exact WBTC amount; PRANA payout is computed on-chain
- `buyBondForPranaAmount(pranaAmount, period)` — target an exact PRANA payout; WBTC cost is computed on-chain

The PRANA Bonding UI and quote API only use **`buyBondForWbtcAmount`**. Enter the WBTC amount you want to spend. Neither create path accepts `minPranaOut` / `maxWbtcIn`. At PRANA's current scale and traffic, adding this mechanism would be unnecessary over-engineering; PRANA Protocol prioritizes a simple design.

## 4. Sell Bond create path

SellPranaBondV2 creates bonds with:

- `sellBond(pranaAmount, period)` — lock an exact PRANA amount you want to sell; WBTC payout is computed on-chain

## 5. Fee, terms, and minimums

Create/quote math includes a **1% fee**, aligned with the 1% fee of the DEX pool.

Terms come from on-chain `bondRates` (rate and duration per period id). The UI reads live V2 config and defaults toward a 30-day term.

Each contract enforces its own **minimum** create amount. Amounts below minimum, paused state, insufficient reserves, or insufficient treasury capacity make a quote non-executable.

## 6. Claim and vesting

`claimBond(bondId)` pays the currently claimable vested amount while not paused.

Vesting is cumulative from `creationTime`:

- Before maturity: `floor(totalPayout × elapsed / duration) − claimed`
- From maturity: remaining `totalPayout − claimed`, then the bond can be marked fully claimed

`claimedPrana` / `claimedWbtc` are what get subtracted. `lastClaimTime` only prevents two claims at the same timestamp.

## 7. Pause, treasury, and roles

Admin / manager controls (names may appear as `DEFAULT_ADMIN_ROLE` / `BOND_MANAGER_ROLE`), or PRANA Protocol:

- **Pause / unpause** user create and claim paths that require `whenNotPaused`
- Update **rates**, **minimums**, and **impacted reserves**
- **Withdraw** surplus tokens under the contract’s withdraw rules: only **uncommitted** tokens can be withdrawn. Payout already committed to open bonds (`committedPrana` on Buy / `committedWbtc` on Sell) **cannot** be withdrawn; admin can only withdraw surplus = balance − committed. The other token on each side (WBTC on Buy, PRANA on Sell) is not locked by committed and can be withdrawn in full.
- Manage role membership / ownership according to the deployed AccessControl setup

Committed treasury amounts track payouts still owed to open bonds. Managers cannot invent a higher claimable on an existing bond by changing global rates after creation — each bond stores its own payout terms at create time.

What managers **cannot** do with current code intent:

- Silently rewrite an already-created bond’s stored principal/payout/term snapshot through a rate update meant for new bonds
- Claim on behalf of another user through a public admin claim path (there is none)
- Remove the need for users to hold POL for their own create/claim transactions

Pause, reserve updates, funding levels, and role keys remain real operational risks. Always read the [Terms & Risk Disclosure](/terms).

## 8. Practical checklist before you bond

- Confirm **Polygon** and the official Buy/Sell V1/V2 addresses linked from [/bond/](/bond/)
- Remember: **new bonds = V2 only**; V1 is view/claim history
- Keep a little POL for Approve, Create, and later Claim transactions

For step-by-step wallet prompts, see the [Bonding guide](/guide/bonding/).