---
name: protocol automation foundation
overview: Tightened repository-specific plan for evolving `prana-stats` into a deterministic protocol monitoring foundation, with Phase 1 deliberately limited to canonical state, source trust, and a minimal Core Watcher.
todos:
  - id: define-canonical-state
    content: Define a minimal `ProtocolStateSnapshot` and `SourceHealth` schema for market, treasury, staking interest, bond capacity, and global state only.
    status: pending
  - id: build-collector-adapters
    content: Wrap current loaders into tiered collector adapters that explicitly label source tier, freshness, trust level, and the migration path away from UI-shaped aggregators like `pranaStats.ts`.
    status: pending
  - id: build-core-watcher
    content: Create a simple cron-driven Core Watcher that writes latest/history JSON files and does not execute anything.
    status: pending
  - id: add-policy-layer
    content: Add a separate `PolicyEvaluation` object with red-button flags, replay-tested thresholds, transition-based alerting, severity gating, and cooldown behavior.
    status: pending
  - id: log-operator-overrides
    content: Add structured operator decision and manual override logging with `snapshotId` and `decisionScope` so founder judgment becomes observable and later codifiable.
    status: pending
isProject: false
---

# PRANA Protocol Automation Foundation Plan

## A. Repository Understanding
### Repo architecture summary
This repo is already more than a frontend app. It is a mixed system with 4 real layers:

- Dashboard UI in [`/Users/prana/prana-stats/components`](file:///Users/prana/prana-stats/components) and [`/Users/prana/prana-stats/hooks`](file:///Users/prana/prana-stats/hooks)
- Runtime data server in [`/Users/prana/prana-stats/server`](file:///Users/prana/prana-stats/server)
- Snapshot/update scripts in [`/Users/prana/prana-stats/scripts`](file:///Users/prana/prana-stats/scripts)
- Domain math, constants, and protocol helpers in [`/Users/prana/prana-stats/utils`](file:///Users/prana/prana-stats/utils), [`/Users/prana/prana-stats/constants`](file:///Users/prana/prana-stats/constants), and [`/Users/prana/prana-stats/contracts`](file:///Users/prana/prana-stats/contracts)

The correct automation center of gravity is still `server/loaders` + `scripts` + reusable `utils`, not React.

### Main modules/files/directories and their roles
- [`/Users/prana/prana-stats/server/index.ts`](file:///Users/prana/prana-stats/server/index.ts): current API/runtime gateway
- [`/Users/prana/prana-stats/server/loaders/pranaStats.ts`](file:///Users/prana/prana-stats/server/loaders/pranaStats.ts): current aggregator for price, staking, and bond display stats
- [`/Users/prana/prana-stats/server/loaders/pranaPrices.ts`](file:///Users/prana/prana-stats/server/loaders/pranaPrices.ts): BTC/USD/VND and historical JSON ingestion
- [`/Users/prana/prana-stats/server/loaders/capital.ts`](file:///Users/prana/prana-stats/server/loaders/capital.ts): protocol wallet balances
- [`/Users/prana/prana-stats/server/loaders/bondMetrics.ts`](file:///Users/prana/prana-stats/server/loaders/bondMetrics.ts): bond committed/balance/volume state
- [`/Users/prana/prana-stats/server/loaders/lpCapital.ts`](file:///Users/prana/prana-stats/server/loaders/lpCapital.ts): LP valuation logic
- [`/Users/prana/prana-stats/scripts/update-bonds-v2.ts`](file:///Users/prana/prana-stats/scripts/update-bonds-v2.ts): bond snapshot updater
- [`/Users/prana/prana-stats/scripts/fetch-active-stakes.ts`](file:///Users/prana/prana-stats/scripts/fetch-active-stakes.ts): active stake snapshot generator
- [`/Users/prana/prana-stats/scripts/update-top-holding-addresses.ts`](file:///Users/prana/prana-stats/scripts/update-top-holding-addresses.ts): curated holder snapshot updater
- [`/Users/prana/prana-stats/utils/bondingStats.ts`](file:///Users/prana/prana-stats/utils/bondingStats.ts): reusable bond math
- [`/Users/prana/prana-stats/utils/pranaStatsUtils.ts`](file:///Users/prana/prana-stats/utils/pranaStatsUtils.ts): shared price/performance helpers
- [`/Users/prana/prana-stats/utils/uniswapV3Helpers.ts`](file:///Users/prana/prana-stats/utils/uniswapV3Helpers.ts): reusable LP math

### Current layer split
- Data ingestion:
  - `server/loaders/*`
  - `scripts/*`
- Stat computation:
  - `server/loaders/pranaStats.ts`
  - `utils/bondingStats.ts`
  - `utils/pranaStatsUtils.ts`
- Business logic:
  - split between `server/loaders`, `utils`, and some UI leakage
- UI/presentation:
  - `components/*`
  - React-facing `hooks/*`
- Config/constants:
  - `constants/*`
- Utilities/helpers:
  - `utils/*`

### What already looks reusable for automation
- [`/Users/prana/prana-stats/server/loaders/bondMetrics.ts`](file:///Users/prana/prana-stats/server/loaders/bondMetrics.ts)
- [`/Users/prana/prana-stats/server/loaders/capital.ts`](file:///Users/prana/prana-stats/server/loaders/capital.ts)
- [`/Users/prana/prana-stats/server/loaders/pranaPrices.ts`](file:///Users/prana/prana-stats/server/loaders/pranaPrices.ts)
- [`/Users/prana/prana-stats/utils/bondingStats.ts`](file:///Users/prana/prana-stats/utils/bondingStats.ts)
- [`/Users/prana/prana-stats/utils/pranaStatsUtils.ts`](file:///Users/prana/prana-stats/utils/pranaStatsUtils.ts)

### Important boundary note for `pranaStats.ts`
[`/Users/prana/prana-stats/server/loaders/pranaStats.ts`](file:///Users/prana/prana-stats/server/loaders/pranaStats.ts) is acceptable as a short-term borrowed input for Phase 1, but it is not the desired long-term source boundary. It is an aggregator shaped by dashboard needs. The watcher may use it initially, but the plan should assume a steady extraction path where market and staking-interest reads are peeled into dedicated collectors so the watcher does not inherit UI-shaped semantics.

### What should remain separate as UI/presentation
- [`/Users/prana/prana-stats/components/FaqSection.tsx`](file:///Users/prana/prana-stats/components/FaqSection.tsx)
- [`/Users/prana/prana-stats/components/Manifesto.tsx`](file:///Users/prana/prana-stats/components/Manifesto.tsx)
- [`/Users/prana/prana-stats/components/Timeline.tsx`](file:///Users/prana/prana-stats/components/Timeline.tsx)
- Most chart rendering code
- Most presentational cards and tooltips

## B. Current Protocol State Coverage
The key change here is priority. For Phase 1, only 4 domains are critical: market, treasury, staking interest, bond capacity.

### Market state
Already exists:
- PRANA price in SAT, USD, VND via [`/Users/prana/prana-stats/server/loaders/pranaStats.ts`](file:///Users/prana/prana-stats/server/loaders/pranaStats.ts)
- BTC/USD and BTC/VND via [`/Users/prana/prana-stats/server/loaders/pranaPrices.ts`](file:///Users/prana/prana-stats/server/loaders/pranaPrices.ts)

Partially available:
- historical `data_*.json` files are expected but missing in this checkout
- some display logic still depends on UI-side fetches

Still missing for automation use:
- canonical source provenance
- freshness classification
- trust labeling for price history files

### Treasury / capital state
Already exists:
- Polygon USDT, Polygon WBTC, Arbitrum USDT balances in [`/Users/prana/prana-stats/server/loaders/capital.ts`](file:///Users/prana/prana-stats/server/loaders/capital.ts)
- LP valuation in [`/Users/prana/prana-stats/server/loaders/lpCapital.ts`](file:///Users/prana/prana-stats/server/loaders/lpCapital.ts)

Partially available:
- current app tends to compress capital into one total
- wallet classification is still implicit and partly display-shaped

Still missing for automation use:
- explicit liquidity buckets:
  - liquid stable capital
  - liquid BTC capital
  - restricted or frictional capital
- deployable capital semantics instead of one pretty USD total

### Staking state
Already exists:
- `stakedPrana`
- `interestContractBalancePrana`
- `interestPrana`
- runway math already exists in hooks

Partially available:
- APR assumption is still hardcoded in UI-oriented logic

Still missing for automation use:
- canonical staking coverage ratio as a first-class metric
- source trust/freshness metadata

### Bond state
Already exists:
- buy committed/balance totals
- sell committed/balance totals
- buy/sell utilization can be derived from current loaders and `utils/bondingStats.ts`

Partially available:
- bond detail snapshots exist, but are not trustworthy enough for Phase 1 policy inputs because the updater is incremental and can leave old records stale

Still missing for automation use:
- explicit bond utilization metrics as canonical watcher outputs
- source freshness and trust labeling around bond snapshots vs direct reads

### Lower-priority domains for Phase 1
These should not be on the critical path of the first watcher:
- supply accounting
- top holders / buyable supply
- active stake maturity ladders
- claimable-now bond detail
- impacted reserve sync monitoring
- LP APR policy use
- yield farming / capital deployment scoring

## C. Automation Foundation Gap Analysis
### 1. No canonical state object
There is still no single `ProtocolStateSnapshot` representing protocol truth in one place.

### 2. State and policy are not separated hard enough
The repo currently mixes facts and interpretation. For the automation foundation, these must be separate:
- `ProtocolStateSnapshot` = truth
- `PolicyEvaluation` = current rule-based interpretation of truth

Readiness, approval status, and proposal sizes must not live in the state object.

### 3. Source-of-truth tiers are not explicit
This is the most important architectural correction.

The system should rank data sources like this:
- Tier 1: direct on-chain reads and contract state
- Tier 2: server loaders that normalize Tier 1 reads
- Tier 3: cached/generated JSON snapshots
- Tier 4: UI-only derived views

The watcher should attach source trust to every important metric and compute a global trust band from explicit rules, not from a pseudo-score.

### 4. Capital semantics are too weak
A single “Protocol Controlled Capital total” is not enough for automation. It hides liquidity differences and can mislead future policies.

### 5. Manual override is not modeled
Founder overrides are currently external to the system. That means founder intuition cannot be observed, audited, or converted into rules later.

### 6. Alerting can easily become noisy
A notifier without transition logic and cooldown will fail operationally even if it works technically.

### 7. History should stay intentionally poor at first
The plan must resist adding databases, queues, and orchestration frameworks too early. A disciplined file-based history is enough for Phase 1, but it should still have a simple retention policy from day one so the history layer does not become an uncontrolled file forest.

## D. Proposed Minimal Architecture
### Simplest good v1 architecture
Use this exact layering:

1. `collector adapters`
- wrap existing loaders and direct reads
- return raw values plus metadata
- keep `raw` naming inside the collector layer only, not in canonical state

2. `source health + source tier normalizer`
- adds:
  - `sourceTier`
  - `sourceStatus`
  - `collectedAt`
  - `lastKnownBlock`
  - `lastSuccessAt`
  - `errorCount`
  - `globalConfidenceBand`

Band rules for `globalConfidenceBand`:
- `high` if all required Tier 1 and Tier 2 sources are fresh
- `degraded` if some source is stale but a trusted fallback still exists
- `low` if a required source is missing, inconsistent, or not trustworthy enough for policy use

3. `protocol state builder`
- builds one minimal `ProtocolStateSnapshot`
- only 4 critical domains in v1:
  - market
  - treasury
  - staking interest
  - bond capacity

4. `policy evaluator`
- separate object: `PolicyEvaluation`
- consumes snapshot
- outputs health bands, blocks, transition events, and reasons

5. `watcher runner`
- cron every 5 minutes
- writes `latest` + `history`

6. `notifier`
- only sends transition-based alerts with cooldown
- only escalates when severity gates are crossed

7. `manual annotations`
- operator/founder overrides stored separately and read by policy evaluation

### How this maps onto this repo
- Collectors start from:
  - [`/Users/prana/prana-stats/server/loaders/pranaStats.ts`](file:///Users/prana/prana-stats/server/loaders/pranaStats.ts)
  - [`/Users/prana/prana-stats/server/loaders/capital.ts`](file:///Users/prana/prana-stats/server/loaders/capital.ts)
  - [`/Users/prana/prana-stats/server/loaders/bondMetrics.ts`](file:///Users/prana/prana-stats/server/loaders/bondMetrics.ts)
  - optionally [`/Users/prana/prana-stats/server/loaders/lpCapital.ts`](file:///Users/prana/prana-stats/server/loaders/lpCapital.ts) for observation only
- Phase 1 may borrow from `pranaStats.ts`, but the collector contract should be designed so market and staking-interest logic can be split away from it without changing the watcher schema.
- State builder becomes the new domain center.
- React becomes only a consumer of state/evaluation outputs.

## E. Core Watcher v1 Plan
### Exact responsibilities
The first watcher should answer one question only:

`Ngay bây giờ PRANA có khỏe không, có đủ đạn không, và dữ liệu này có đáng tin không?`

That means v1 only needs to:
- read core state
- compute a minimal snapshot
- compute a few derived metrics
- classify source freshness/trust
- write files
- optionally emit transition alerts

It should not:
- model full bond lifecycles
- compute claimable-now
- model staking maturity ladders
- use LP APR as policy input
- touch supply or top-holder heuristics

### Exact inputs for v1
Required:
- market data from [`/Users/prana/prana-stats/server/loaders/pranaPrices.ts`](file:///Users/prana/prana-stats/server/loaders/pranaPrices.ts) and [`/Users/prana/prana-stats/server/loaders/pranaStats.ts`](file:///Users/prana/prana-stats/server/loaders/pranaStats.ts)
- treasury balances from [`/Users/prana/prana-stats/server/loaders/capital.ts`](file:///Users/prana/prana-stats/server/loaders/capital.ts)
- staking interest state from [`/Users/prana/prana-stats/server/loaders/pranaStats.ts`](file:///Users/prana/prana-stats/server/loaders/pranaStats.ts)
- bond committed/capacity state from [`/Users/prana/prana-stats/server/loaders/bondMetrics.ts`](file:///Users/prana/prana-stats/server/loaders/bondMetrics.ts)

Optional observational input only:
- LP valuation from [`/Users/prana/prana-stats/server/loaders/lpCapital.ts`](file:///Users/prana/prana-stats/server/loaders/lpCapital.ts)

Deferred:
- `active_stakes.json`
- `bonds_v2_details.json`
- `top_holding_addresses.json`
- `buy_dips.json`

### Exact outputs
Keep persistence minimal:
- `storage/core-watcher/latest-state.json`
- `storage/core-watcher/latest-evaluation.json`
- `storage/core-watcher/latest-transition.json`
- `storage/core-watcher/history/YYYY-MM-DD/*.json`
- `storage/core-watcher/operator_decisions.json`

Retention policy:
- keep detailed snapshot files for 30 days
- keep daily summaries longer
- do not introduce a database in Phase 1

### Exact derived metrics for v1
Only these:

- market:
  - `pranaPriceSat`
  - `pranaPriceUsd`
  - `pranaPriceVnd`
- treasury:
  - `liquidStableUsd`
  - `liquidBtcUsd`
  - `restrictedOrFrictionalCapitalUsd`
  - `totalCapitalUsd`
- staking interest:
  - `interestBalancePrana`
  - `interestCommittedPrana`
  - `runwayDays`
  - `stakingCoverageRatio`
- bonds:
  - `buyCommittedPrana`
  - `buyCapacityPrana`
  - `buyUtilization`
  - `sellCommittedSat`
  - `sellCapacitySat`
  - `sellUtilization`
- data trust:
  - `missingSources`
  - `staleSources`
  - `globalConfidenceBand`
- global state:
  - `globalState`
  - `summaryReason`
  - `primaryStressDomain`
  - `primaryStressMetric`

Canonical schema rule:
- every metric in `ProtocolStateSnapshot` must carry a clear unit in its name or schema
- `raw` fields stay in collector outputs only, not in canonical state

### What should be config-driven
- freshness thresholds
- utilization bands
- staking coverage bands
- capital floor
- watcher interval
- alert cooldown window
- source tier definitions
- severity gates for notifications

### What should be hardcoded in v1
- file-based persistence
- one cron loop every 5 minutes
- one environment
- notifier output is `local file + console` only

First notifier expansion after v1:
- one external target only, preferably Telegram or Discord

### What should be deferred
- Buy the Dips scoring
- proposal generation
- execution
- supply accounting
- LP management
- bond lifecycle reconciliation
- impacted reserve sync monitoring

Important rule for later phases:
- Buy the Dips recommendation layers must read only from `ProtocolStateSnapshot` and `PolicyEvaluation`, never by reading back dashboard artifacts or secondary narrative files

## F. Buy the Dips Automation Roadmap
### Phase 0: monitoring only
Automated:
- canonical state
- source trust
- global health classification
- primary stress metric identification

Human approval:
- all actions manual

Risks to control:
- false confidence from stale data
- incorrect deployable-capital assumptions

### Phase 1: recommendation readiness
Automated:
- deterministic `PolicyEvaluation`
- recommendation status such as:
  - `not_ready`
  - `watch`
  - `ready_for_review`

Human approval:
- founder/operator still decides

Risks to control:
- mixing policy outputs into state history
- premature complexity
- recommendation logic reading from anything other than canonical state + policy inputs

### Phase 2: deterministic proposal generation
Automated:
- proposal band and rationale
- conservative caps

Human approval:
- required

Risks to control:
- proposal based on weak liquidity assumptions

### Phase 3: limited execution with hard caps
Automated:
- only very constrained execution paths

Human approval:
- default on

Risks to control:
- signer and configuration risk

### Phase 4: mature automation with safeguards
Automated:
- bounded execution under explicit guardrails

Human approval:
- only for exceptional paths

Risks to control:
- policy drift
- execution under degraded data trust

## G. Future Expansion Paths
This same foundation can later support:

- LP management
- treasury allocation and deployable-capital policy
- DeFi yield opportunity monitoring
- impacted reserve syncing and reconciliation
- bond lifecycle accounting
- supply and market-structure modules

The important design choice is that these plug into the existing state/policy split instead of reshaping it.

## H. Founder Dependence Reduction Plan
### Where founder judgment likely lives now
- “Có đủ đạn không?”
- “Dữ liệu có đáng tin không?”
- “Mức này đáng theo dõi hay đáng hành động?”
- “Có nên bỏ qua rule trong trường hợp đặc biệt không?”

### Practical conversion path
1. First, log founder/operator overrides.
2. Then classify them by reason.
3. Then convert repeated reasons into rules or thresholds.
4. Then attach expiry and scope to overrides.

### Manual override layer
Add `operator_decisions.json` or `manual_annotations` with fields like:
- `timestamp`
- `snapshotId`
- `linkedSnapshotHash` when available
- `overrideType`
- `decisionScope`
- `reason`
- `expiresAt`
- `enteredBy`

This becomes the bridge from founder intuition to machine-readable policy.

### Red button layer
Add these fields to policy config from day one, even before execution exists:
- `automation_paused`
- `data_trust_block`
- `capital_floor_block`
- `manual_override_active`

## I. File-by-File Refactor / Build Plan
### Keep mostly as-is
- [`/Users/prana/prana-stats/components/FaqSection.tsx`](file:///Users/prana/prana-stats/components/FaqSection.tsx)
- [`/Users/prana/prana-stats/components/Manifesto.tsx`](file:///Users/prana/prana-stats/components/Manifesto.tsx)
- [`/Users/prana/prana-stats/components/Timeline.tsx`](file:///Users/prana/prana-stats/components/Timeline.tsx)
- [`/Users/prana/prana-stats/utils/uniswapV3Helpers.ts`](file:///Users/prana/prana-stats/utils/uniswapV3Helpers.ts)
- [`/Users/prana/prana-stats/constants/bonds.ts`](file:///Users/prana/prana-stats/constants/bonds.ts)
- [`/Users/prana/prana-stats/constants/sharedContracts.ts`](file:///Users/prana/prana-stats/constants/sharedContracts.ts)
- [`/Users/prana/prana-stats/constants/stakingContracts.ts`](file:///Users/prana/prana-stats/constants/stakingContracts.ts)

### Refactor first
- [`/Users/prana/prana-stats/server/loaders/capital.ts`](file:///Users/prana/prana-stats/server/loaders/capital.ts)
  - separate liquid stable, liquid BTC, and restricted/frictional capital semantics
- [`/Users/prana/prana-stats/server/loaders/pranaStats.ts`](file:///Users/prana/prana-stats/server/loaders/pranaStats.ts)
  - treat as a temporary borrowed aggregator
  - extract market and staking-interest state into dedicated collectors over time
- [`/Users/prana/prana-stats/server/cacheHelpers.ts`](file:///Users/prana/prana-stats/server/cacheHelpers.ts)
  - remove request-driven watcher assumptions from the future automation path
- [`/Users/prana/prana-stats/server/utils/providers.ts`](file:///Users/prana/prana-stats/server/utils/providers.ts)
  - move shared provider/env logic into a neutral shared module
- [`/Users/prana/prana-stats/types.ts`](file:///Users/prana/prana-stats/types.ts)
  - split domain types from API/UI types

### Lower-priority refactors
These should wait until after watcher v1 is stable:
- [`/Users/prana/prana-stats/components/Supply.tsx`](file:///Users/prana/prana-stats/components/Supply.tsx)
- [`/Users/prana/prana-stats/components/TopHoldingAddresses.tsx`](file:///Users/prana/prana-stats/components/TopHoldingAddresses.tsx)
- [`/Users/prana/prana-stats/components/PranaVndPriceChart.tsx`](file:///Users/prana/prana-stats/components/PranaVndPriceChart.tsx)
- [`/Users/prana/prana-stats/components/SatsPriceChart.tsx`](file:///Users/prana/prana-stats/components/SatsPriceChart.tsx)

### New modules to create
- `domain/protocolState/types.ts`
- `domain/protocolState/buildProtocolState.ts`
- `domain/protocolState/sourceHealth.ts`
- `domain/policy/types.ts`
- `domain/policy/evaluatePolicy.ts`
- `domain/policy/replayPolicy.ts`
- `services/collectors/loadMarketState.ts`
- `services/collectors/loadTreasuryState.ts`
- `services/collectors/loadStakingInterestState.ts`
- `services/collectors/loadBondCapacityState.ts`
- `services/coreWatcher/runCoreWatcher.ts`
- `services/coreWatcher/storeOutputs.ts`
- `services/coreWatcher/detectTransitions.ts`
- `services/coreWatcher/notifier.ts`
- `services/coreWatcher/retention.ts`
- `config/sourceTiers.ts`
- `config/watcherRules.ts`
- `config/manualControls.ts`

## J. MVP Execution Plan
### First 3 days
- define `ProtocolStateSnapshot`
- define `SourceHealth`
- define tier model
- build collector adapters around current loaders
- write `latest-state.json`

### First 7 days
- add simple watcher loop every 5 minutes
- add `latest-evaluation.json`
- add daily append-only history
- add minimal derived metrics:
  - staking coverage
  - buy utilization
  - sell utilization
  - capital buckets
  - global state
- add retention rules for detailed vs summary history

### Between day 7 and day 14
- run replay tests on recent watcher outputs if they already exist
- if watcher outputs do not exist yet, replay from current loaders sampled repeatedly across several days
- verify derived metrics do not jump unexpectedly
- tune freshness thresholds before policy logic depends on them
- confirm the global trust band and primary stress metric behave predictably

### First 14 days
- add separate `PolicyEvaluation`
- add red-button flags
- add operator decisions file
- add transition detection
- add alert cooldown behavior
- add severity gating so only band-changing events can page operators

### First 30 days
- add Buy the Dips recommendation layer
- still no execution
- only after watcher outputs are stable and trusted

## K. Final Recommendation
### Best architecture direction
Keep the architecture brutally simple:
- canonical state first
- trust labeling first
- watcher first
- policy second
- execution later

### Main mistakes to avoid
- do not let cached snapshots sit ngang hàng with on-chain truth
- do not let readiness or recommendation leak into `ProtocolStateSnapshot`
- do not compress capital into one misleading total
- do not let LP APR influence early policy
- do not build noisy every-run alerts
- do not pull supply/top-holders into the critical path of the first watcher
- do not let `pranaStats.ts` become a permanent domain boundary
- do not keep unit-less or `raw`-named fields in canonical state

### Smallest viable next step
Build a minimal Core Watcher whose only job is to say:

`PRANA hiện có khỏe không, có đủ đạn không, và dữ liệu này có đáng tin không?`

And internally, it should also answer:

`Metric nào đang làm cho hệ căng nhất?`

It should read only market, treasury, staking interest, and bond capacity; compute a minimal `ProtocolStateSnapshot`; keep `PolicyEvaluation` separate; and write `latest-state.json`, `latest-evaluation.json`, and append-only daily history.