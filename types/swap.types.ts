import type { HexAddress } from './blockchain.types.ts';

export type { HexAddress };

export type SwapTokenSymbol = 'PRANA' | 'WBTC' | 'POL' | 'USDC' | 'USDT' | 'WETH' | 'DAI';

export type SwapTokenKind = 'native' | 'erc20';

export type SwapToken = {
  symbol: SwapTokenSymbol;
  name: string;
  decimals: number;
  kind: SwapTokenKind;
  address?: HexAddress;
  wrappedAddress?: HexAddress;
};

export type SwapQuoteRequest = {
  tokenInSymbol: SwapTokenSymbol;
  tokenOutSymbol: SwapTokenSymbol;
  amountIn: string;
  recipient: HexAddress;
  slippageBps: number;
};

export type SwapQuoteRequestMetadata = SwapQuoteRequest & {
  amountInRaw: string;
  chainId: number;
};

export type SwapQuoteTransaction = {
  to: HexAddress;
  data: HexAddress;
  value: string;
};

/** Minimal tx shape we validate before returning a quote to the client. */
export type SwapTransactionCandidate = SwapQuoteTransaction;

/**
 * Everything validation needs to check calldata against the user's request.
 * `strictPath` = true for a normal single-leg swap (exact amounts + path ends).
 * `strictPath` = false for multi-leg AlphaRouter routes where each leg
 * only spends part of the total input.
 */
export type SwapValidationContext = {
  request: SwapQuoteRequest;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  amountInRaw: bigint;
  minimumAmountOutRaw: bigint;
  deadline: number;
  strictPath: boolean; // false for AlphaRouter, true for our fallback path
};

export type SwapQuoteVerification = {
  version: 2;
  issuedAt: string;
  expiresAt: string;
  token: string;
};

export type SwapRouteStep = {
  protocol: string;
  path: string[];
  percent: number;
};

export type SwapQuoteResponse = {
  request: SwapQuoteRequestMetadata;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  amountIn: string;
  amountOut: string;
  amountOutRaw: string;
  minimumAmountOut: string;
  route: SwapRouteStep[];
  estimatedGasUsed?: string;
  estimatedGasUsedUsd?: string;
  gasPriceWei?: string;
  routerAddress: HexAddress;
  transaction: SwapQuoteTransaction;
  blockNumber?: string;
  deadline: number;
  quoteUpdatedAt: string;
  verification: SwapQuoteVerification;
};

export type SwapQuoteErrorResponse = {
  error: string;
  message: string;
};

export type SwapTransactionLogEvent =
  | 'approval_submitted'
  | 'approval_confirmed'
  | 'approval_failed'
  | 'swap_submitted'
  | 'swap_confirmed'
  | 'swap_failed';

export type SwapTransactionLogRequest = {
  event: SwapTransactionLogEvent;
  ownerAddress?: HexAddress;
  tokenInSymbol?: SwapTokenSymbol;
  tokenOutSymbol?: SwapTokenSymbol;
  amountIn?: string;
  amountOut?: string;
  amountOutRaw?: string;
  minimumAmountOut?: string;
  route?: SwapRouteStep[];
  routerAddress?: HexAddress;
  transactionHash?: HexAddress;
  error?: string;
  receiptStatus?: string;
};

export type SwapTransactionVerificationRequest = {
  ownerAddress: HexAddress;
  transactionHash: HexAddress;
  quote: SwapQuoteResponse;
};

export type SwapTransactionStatus =
  | 'idle'
  | 'approving'
  | 'approval-confirming'
  | 'approved'
  | 'swapping'
  | 'swap-confirming'
  | 'success'
  | 'error';

export type SwapModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export type UseInjectedWalletResult = {
  address?: HexAddress;
  chainId?: number;
  isConnected: boolean;
  isConnecting: boolean;
  isPolygon: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  ensurePolygon: () => Promise<boolean>;
};

export type UseUniswapQuoteInput = {
  tokenInSymbol: SwapTokenSymbol;
  tokenOutSymbol: SwapTokenSymbol;
  amountIn: string;
  recipient?: HexAddress;
  slippageBps: number;
  enabled: boolean;
};

export type UseUniswapQuoteResult = {
  quote: SwapQuoteResponse | null;
  isLoading: boolean;
  error: string | null;
  isRefreshCoolingDown: boolean;
  refreshCooldownSeconds: number;
  refetch: () => void;
};

export type UseUniswapSwapInput = {
  quote: SwapQuoteResponse | null;
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  amountIn: string;
  slippageBps: number;
  ownerAddress?: HexAddress;
};

export type UseUniswapSwapResult = {
  balance: bigint | null;
  allowance: bigint | null;
  isRefreshingBalances: boolean;
  isQuoteExpired: boolean;
  needsApproval: boolean;
  hasInsufficientBalance: boolean;
  status: SwapTransactionStatus;
  transactionHash: HexAddress | null;
  error: string | null;
  refreshBalances: () => Promise<void>;
  executeSwap: () => Promise<void>;
  resetSwapState: () => void;
};
