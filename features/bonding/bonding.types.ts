import type { Address, Hex } from '../../types/blockchain.types.ts';

/** Buy receives WBTC / pays PRANA; Sell receives PRANA / pays WBTC. */
export type BondSide = 'buy' | 'sell';

/** V1 is claim/history only; new bonds are created on V2. */
export type BondVersion = 'v1' | 'v2';

/** On-chain BondTerm enum: WEEK=0 … YEAR=4. */
export type BondTermId = 0 | 1 | 2 | 3 | 4;

/** One V2 term/rate/duration pair from bondRates(termId). */
export type BondingTermOption = {
  termId: BondTermId;
  /** Discount rate in basis points (decimal string — may exceed safe integer). */
  rateBpsRaw: string;
  durationSeconds: number;
};

/** Paused flags for all four deployments (same blockTag). */
export type BondingDeploymentPaused = {
  buyV1: boolean;
  buyV2: boolean;
  sellV1: boolean;
  sellV2: boolean;
};

export type BondingContractsSnapshot = {
  buyV1: Address;
  buyV2: Address;
  sellV1: Address;
  sellV2: Address;
  prana: Address;
  wbtc: Address;
  pool: Address;
};

/** Protocol config snapshot from GET /api/bonding/config. */
export type BondingConfig = {
  chainId: number;
  blockNumber: number;
  blockTimestamp: number;
  paused: BondingDeploymentPaused;
  /** Min Buy PRANA payout (raw units, decimal string). */
  minBuyPranaRaw: string;
  /** Min Sell input PRANA (raw units, decimal string). */
  minSellPranaRaw: string;
  buyTerms: BondingTermOption[];
  sellTerms: BondingTermOption[];
  contracts: BondingContractsSnapshot;
  pranaDecimals: number;
  wbtcDecimals: number;
};

/**
 * Normalized active bond for account API / UI.
 * Bond id and token amounts stay decimal strings (uint256-safe).
 */
export type ActiveBondRecord = {
  id: string;
  side: BondSide;
  version: BondVersion;
  owner: Address;
  wbtcAmountRaw: string;
  pranaAmountRaw: string;
  maturityTime: number;
  creationTime: number;
  lastClaimTime: number;
  /** claimedPrana (buy) or claimedWbtc (sell). */
  claimedRaw: string;
  claimed: boolean;
};

/** Wallet-specific snapshot from GET /api/bonding/account. */
export type BondingAccount = {
  address: Address;
  blockNumber: number;
  blockTimestamp: number;
  pranaBalanceRaw: string;
  wbtcBalanceRaw: string;
  /** WBTC allowance for BuyPranaBondV2. */
  buyV2WbtcAllowanceRaw: string;
  /** PRANA allowance for SellPranaBondV2. */
  sellV2PranaAllowanceRaw: string;
  bonds: ActiveBondRecord[];
};

export type BondingQuoteMode = 'buy_exact_wbtc' | 'sell_exact_prana';

/** Discriminated quote request for POST /api/bonding/quote. */
export type BondingQuoteRequest =
  | {
      mode: 'buy_exact_wbtc';
      amountRaw: string;
      termId: BondTermId;
    }
  | {
      mode: 'sell_exact_prana';
      amountRaw: string;
      termId: BondTermId;
    };

export type BondingQuoteIssue =
  | 'paused'
  | 'below_minimum'
  | 'exceeds_reserve'
  | 'insufficient_treasury'
  | 'invalid_term'
  | 'zero_amount';

export type BondingReserveSource = 'impacted' | 'market';

/** Quote response — non-executable states still return 200 with issues. */
export type BondingQuote = {
  mode: BondingQuoteMode;
  termId: BondTermId;
  wbtcAmountRaw: string;
  pranaAmountRaw: string;
  rateBpsRaw: string;
  durationSeconds: number;
  blockNumber: number;
  blockTimestamp: number;
  reserveSource: BondingReserveSource;
  issues: BondingQuoteIssue[];
};

/** Fixed write kinds the confirmation API may verify. */
export type BondingTxActionKind = 'approve' | 'create' | 'claim';

/**
 * Minimal action snapshot for POST /api/bonding/confirm-transaction.
 * Server maps side/version → fixed target; client must not supply contract address.
 */
export type BondingTransactionActionSnapshot =
  | {
      kind: 'approve';
      /** Token being approved: WBTC for buy, PRANA for sell. */
      side: BondSide;
      amountRaw: string;
    }
  | {
      kind: 'create';
      side: BondSide;
      /** Create is V2-only. */
      version: 'v2';
      mode: BondingQuoteMode;
      amountRaw: string;
      termId: BondTermId;
    }
  | {
      kind: 'claim';
      side: BondSide;
      version: BondVersion;
      bondId: string;
    };

export type BondingTransactionConfirmationRequest = {
  transactionHash: Hex;
  account: Address;
  action: BondingTransactionActionSnapshot;
};

/**
 * Terminal confirmation, or non-terminal when neither browser nor server
 * can decide — never treat RPC read failure as on-chain revert.
 */
export type BondingTransactionConfirmation =
  | { status: 'confirmed'; source: 'browser' | 'server' }
  | { status: 'reverted'; source: 'browser' | 'server' }
  | { status: 'not_mined' }
  | { status: 'confirmation_unavailable' };

/**
 * Approve → Review → Create Bond → Confirming UI lifecycle (Bước 5).
 * Phases are UI states, not four wallet signature prompts.
 */
export type BondCtaPhase =
  | 'approve'
  | 'review'
  | 'create'
  | 'confirming'
  | 'confirmation_unavailable'
  | 'success'
  | 'error';

export type BondTransactionStatus =
  | 'idle'
  | 'approving'
  | 'reviewing'
  | 'submitting'
  | 'confirming'
  | 'success'
  | 'error'
  | 'confirmation_unavailable';

/** Why bond amount parse rejected an input string. */
export type BondAmountParseReason =
  | 'empty'
  | 'invalid'
  | 'zero'
  | 'negative'
  | 'too_many_decimals';

export type BondAmountParseResult =
  | { ok: true; raw: bigint }
  | { ok: false; reason: BondAmountParseReason };

/** Active claim identity — ids collide across Buy/Sell × V1/V2. */
export type BondClaimActionTarget = {
  side: BondSide;
  version: BondVersion;
  bondId: string;
};

/** Claim eligibility derived from cumulative vesting math + pause gate. */
export type BondActionState = {
  claimableRaw: bigint;
  progressPercent: number;
  /** True when vested−claimed > 0, not fully claimed, and past lastClaimTime. */
  canClaim: boolean;
};
