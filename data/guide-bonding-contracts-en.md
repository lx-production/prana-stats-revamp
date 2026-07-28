# Bonding Contract Explanation

This page explains the on-chain contracts behind **PRANA Bonding**: **BuyPranaBondV2** and **SellPranaBondV2**. Read it with the [Bonding guide](/guide/bonding/) and the [Terms & Risk Disclosure](/terms).

Both contracts run on **Polygon**. Addresses are linked from [/bond/](/bond/) and Polygonscan. This page is educational — always verify live code and parameters on-chain before bonding.

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

Each V2 contract keeps an internal pair of virtual reserves (**impacted reserves**: `impactedWbtcReserve` / `impactedPranaReserve`). After every successful bond creation, the contract updates that pair as if the volume had already “pushed” the AMM curve — so the next bond takes **progressive price impact**, instead of resetting to pool price every time.

**Market reserves** are the live Uniswap V3 WBTC/PRANA pool reserves at the quote/create block.

**When is impacted used vs market?** Create/quote always computes both paths, then picks by the rule “do not give the user a better deal than current market”:

- **Buy exact WBTC** (receive PRANA): keep **impacted** when estimated PRANA from impacted **≤** PRANA from the pool. If impacted would give **more PRANA than** the pool → reset impacted = pool and use **market**.
- **Buy target PRANA** (spend WBTC): keep **impacted** when estimated WBTC from impacted **≥** WBTC from the pool. If impacted would cost **less WBTC than** the pool → reset impacted = pool and use **market**.
- **Sell exact PRANA** (receive WBTC): keep **impacted** when estimated WBTC from impacted **≤** WBTC from the pool. If impacted would give **more WBTC than** the pool → reset impacted = pool and use **market**.

In short:

- **Impacted** is the default when recent bonding volume already made the bond price worse than (or equal to) the live pool.
- **Market** is used only when impacted has drifted **in the user’s favor** vs the pool — for example after the pool moves, or after an admin `sync`/`set` — then the contract syncs impacted to the pool and quotes/creates from market.

So where is the Bonding OTC edge? The guard above only constrains the reserve path **before** premium/discount — it stops the bond’s AMM baseline from beating live pool price. **The OTC edge is the `bondRates` applied after that:** Buy gets a **discount** on that baseline; Sell gets a **premium** on that baseline, in exchange for payout vesting over the chosen term.

Bluntly: if after discount/premium (and waiting for vesting) bonding is **not better than** swapping directly on the DEX, **swap on the DEX** instead of creating a bond.

The quote API returns `reserveSource: "impacted" | "market"` so the UI knows which path was used. On-chain `calculate*Amount` views read impacted only (they do not compare market); the market auto-sync branch lives in the create functions (and the backend quote mirrors create).

Managers with `BOND_MANAGER_ROLE` can call:

- `syncImpactedReserves` — copy current pool reserves into impacted
- `setImpactedReserves` — set impacted WBTC/PRANA reserve values directly

These are admin operations, not user wallet actions. Reserve changes can move quotes for new bonds; they do not rewrite payouts already recorded on existing bonds.

## 3. Buy Bond create paths

BuyPranaBondV2 exposes two create functions:

- `buyBondForWbtcAmount(wbtcAmount, period)` — spend an exact WBTC amount; PRANA payout is computed on-chain
- `buyBondForPranaAmount(pranaAmount, period)` — target an exact PRANA payout; WBTC cost is computed on-chain

Important limits in the current contracts:

- There is **no** `minPranaOut` on exact-WBTC buys
- There is **no** `maxWbtcIn` on target-PRANA buys

So the official UI cannot promise a locked output or a hard on-chain input ceiling beyond the ERC-20 allowance used as a practical spending cap for Target PRANA.

## 4. Sell Bond create path

SellPranaBondV2 creates bonds with:

- `sellBond(pranaAmount, period)` — lock an exact PRANA amount; WBTC payout is computed on-chain

There is **no** `minWbtcOut`. Exact PRANA in is fixed; WBTC out can still change if reserves/rates/treasury move before execution.

## 5. Fee, terms, and minimums

Create/quote math includes a **1% fee** path aligned with the Solidity formula (integer division / flooring).

Terms come from on-chain `bondRates` (rate and duration per period id). The UI reads live V2 config and defaults toward a 30-day term when available.

Each contract enforces its own **minimum** create amount. Amounts below minimum, paused state, insufficient reserves, or insufficient treasury capacity make a quote non-executable.

## 6. Claim and vesting

`claimBond(bondId)` pays the currently claimable vested amount while not paused.

Vesting is cumulative from `creationTime`:

- Before maturity: `floor(totalPayout × elapsed / duration) − claimed`
- From maturity: remaining `totalPayout − claimed`, then the bond can be marked fully claimed

`claimedPrana` / `claimedWbtc` are what get subtracted. `lastClaimTime` only prevents two claims at the same timestamp; it does **not** restart vesting from the last claim the way Staking interest does.

## 7. Pause, treasury, and roles

Admin / manager controls (names may appear as `DEFAULT_ADMIN_ROLE` / `BOND_MANAGER_ROLE`):

- **Pause / unpause** user create and claim paths that require `whenNotPaused`
- Update **rates**, **minimums**, and **impacted reserves**
- **Withdraw** surplus tokens under the contract’s withdraw rules
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
- Understand there is no on-chain `minOut` / `maxIn` slip protection on create
- For Target PRANA Buy, treat WBTC allowance as the practical spending cap
- Keep POL for Approve, Create, and later Claim transactions
- Watch pause, minimum, reserve, and treasury issues shown on the quote before confirming

For step-by-step wallet prompts, see the [Bonding guide](/guide/bonding/).
