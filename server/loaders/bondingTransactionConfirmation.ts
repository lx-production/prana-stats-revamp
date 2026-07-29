import { ethers } from 'ethers';
import { erc20Abi } from 'viem';
import { getServerPolygonProvider } from '../utils/providers.ts';
import {
  BondingConfirmationMismatchError,
  parseUnsignedDecimalRaw,
} from '../utils/bondingReadUtils.ts';
import {
  BUY_BOND_V2_ABI,
  SELL_BOND_V2_ABI,
  BUY_BOND_ADDRESS_V1,
  BUY_BOND_ADDRESS_V2,
  SELL_BOND_ADDRESS_V1,
  SELL_BOND_ADDRESS_V2,
  BUY_BOND_ACCOUNT_ABI,
  SELL_BOND_ACCOUNT_ABI,
} from '../../constants/bonds.ts';
import { PRANA_ADDRESS, WBTC_ADDRESS } from '../../constants/sharedContracts.ts';

import type { Address, Hex } from '../../types/blockchain.types.ts';
import type {
  BondingTransactionActionSnapshot,
  BondingTransactionConfirmation,
  BondingTransactionConfirmationRequest,
} from '../../features/bonding/bonding.types.ts';

const ERC20_IFACE = new ethers.Interface(erc20Abi);
const BUY_V2_IFACE = new ethers.Interface(BUY_BOND_V2_ABI);
const SELL_V2_IFACE = new ethers.Interface(SELL_BOND_V2_ABI);
const BUY_ACCOUNT_IFACE = new ethers.Interface(BUY_BOND_ACCOUNT_ABI);
const SELL_ACCOUNT_IFACE = new ethers.Interface(SELL_BOND_ACCOUNT_ABI);

/** Minimal RPC surface — real provider or a test double. */
export type BondingConfirmationLookupProvider = {
  getTransaction(hash: string): Promise<{
    from: string;
    to?: string | null;
    data: string;
    chainId?: number | bigint | null;
  } | null>;
  getTransactionReceipt(hash: string): Promise<{
    status: number | null;
  } | null>;
};

type BondingConfirmationDependencies = {
  getProvider?: () => Promise<BondingConfirmationLookupProvider>;
};

type ExpectedCall = {
  target: Address;
  data: Hex;
};

/**
 * Fallback confirmation via server Polygon RPC.
 * Maps side/version/kind → fixed contract + calldata; never trusts client addresses.
 * RPC read failures become confirmation_unavailable (not reverted).
 */
export async function confirmBondingTransaction(
  request: BondingTransactionConfirmationRequest,
  dependencies: BondingConfirmationDependencies = {},
): Promise<BondingTransactionConfirmation> {
  const expected = buildExpectedCall(request.action);
  const loadProvider = dependencies.getProvider ?? getServerPolygonProvider;

  let provider: BondingConfirmationLookupProvider;
  try {
    provider = await loadProvider();
  } catch {
    return { status: 'confirmation_unavailable' };
  }

  let transaction: Awaited<
    ReturnType<BondingConfirmationLookupProvider['getTransaction']>
  >;
  let receipt: Awaited<
    ReturnType<BondingConfirmationLookupProvider['getTransactionReceipt']>
  >;

  try {
    [transaction, receipt] = await Promise.all([
      provider.getTransaction(request.transactionHash),
      provider.getTransactionReceipt(request.transactionHash),
    ]);
  } catch {
    return { status: 'confirmation_unavailable' };
  }

  if (!transaction || !receipt) {
    return { status: 'not_mined' };
  }

  // Match sender / target / full calldata before trusting receipt status.
  if (transaction.from.toLowerCase() !== request.account.toLowerCase()) {
    throw new BondingConfirmationMismatchError(
      'Bonding transaction sender does not match account.',
    );
  }

  if (transaction.to?.toLowerCase() !== expected.target.toLowerCase()) {
    throw new BondingConfirmationMismatchError(
      'Bonding transaction target does not match expected contract.',
    );
  }

  if (transaction.data.toLowerCase() !== expected.data.toLowerCase()) {
    throw new BondingConfirmationMismatchError(
      'Bonding transaction calldata does not match expected action.',
    );
  }

  if (receipt.status === 1) {
    return { status: 'confirmed', source: 'server' };
  }

  if (receipt.status === 0) {
    return { status: 'reverted', source: 'server' };
  }

  // status null/unknown — do not invent a terminal on-chain result.
  return { status: 'confirmation_unavailable' };
}

/** Resolve fixed target + calldata from the action snapshot (internal mapping only). */
export function buildExpectedCall(
  action: BondingTransactionActionSnapshot,
): ExpectedCall {
  if (action.kind === 'approve') {
    const amount = parseUnsignedDecimalRaw(action.amountRaw);
    if (amount === null) {
      throw new BondingConfirmationMismatchError('Invalid approve amount.');
    }
    const token = action.side === 'buy' ? WBTC_ADDRESS : PRANA_ADDRESS;
    const spender = action.side === 'buy' ? BUY_BOND_ADDRESS_V2 : SELL_BOND_ADDRESS_V2;
    return {
      target: token,
      data: ERC20_IFACE.encodeFunctionData('approve', [spender, amount]) as Hex,
    };
  }

  if (action.kind === 'create') {
    const amount = parseUnsignedDecimalRaw(action.amountRaw);
    if (amount === null) {
      throw new BondingConfirmationMismatchError('Invalid create amount.');
    }

    if (action.mode === 'buy_exact_wbtc') {
      return {
        target: BUY_BOND_ADDRESS_V2,
        data: BUY_V2_IFACE.encodeFunctionData('buyBondForWbtcAmount', [
          amount,
          action.termId,
        ]) as Hex,
      };
    }

    return {
      target: SELL_BOND_ADDRESS_V2,
      data: SELL_V2_IFACE.encodeFunctionData('sellBond', [
        amount,
        action.termId,
      ]) as Hex,
    };
  }

  // claim
  const bondId = parseUnsignedDecimalRaw(action.bondId);
  if (bondId === null) {
    throw new BondingConfirmationMismatchError('Invalid claim bond id.');
  }

  if (action.side === 'buy') {
    const target = action.version === 'v1' ? BUY_BOND_ADDRESS_V1 : BUY_BOND_ADDRESS_V2;
    return {
      target,
      data: BUY_ACCOUNT_IFACE.encodeFunctionData('claimBond', [bondId]) as Hex,
    };
  }

  const target = action.version === 'v1' ? SELL_BOND_ADDRESS_V1 : SELL_BOND_ADDRESS_V2;
  return {
    target,
    data: SELL_ACCOUNT_IFACE.encodeFunctionData('claimBond', [bondId]) as Hex,
  };
}
