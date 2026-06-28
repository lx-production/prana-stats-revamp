export type SwapTokenSymbol = 'PRANA' | 'WBTC' | 'POL' | 'USDC' | 'USDT' | 'WETH' | 'DAI';

export type SwapTokenKind = 'native' | 'erc20';

export type HexAddress = `0x${string}`;

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

export type SwapQuoteTransaction = {
  to: HexAddress;
  data: HexAddress;
  value: string;
};

export type SwapRouteStep = {
  protocol: string;
  path: string[];
  percent: number;
};

export type SwapQuoteResponse = {
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
  quoteUpdatedAt: string;
};

export type SwapQuoteErrorResponse = {
  error: string;
  message: string;
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
  refetch: () => void;
};

export type UseUniswapSwapInput = {
  quote: SwapQuoteResponse | null;
  tokenIn: SwapToken;
  ownerAddress?: HexAddress;
};

export type UseUniswapSwapResult = {
  balance: bigint | null;
  allowance: bigint | null;
  isRefreshingBalances: boolean;
  needsApproval: boolean;
  hasInsufficientBalance: boolean;
  status: SwapTransactionStatus;
  transactionHash: HexAddress | null;
  error: string | null;
  refreshBalances: () => Promise<void>;
  executeSwap: () => Promise<void>;
  resetSwapState: () => void;
};
