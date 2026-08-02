import { erc20Abi } from 'viem';
import { ethers } from 'ethers';
import { getServerPolygonProvider } from '../utils/providers.ts';
import { PRANA_ADDRESS, WBTC_ADDRESS } from '../../constants/sharedContracts.ts';
import { confirmTransactionOnChain } from '../utils/transactionConfirmationLookup.ts';
import { BondingConfirmationMismatchError, parseUnsignedDecimalRaw } from '../utils/bondingReadUtils.ts';
import { BUY_BOND_V2_ABI, SELL_BOND_V2_ABI, BUY_BOND_ADDRESS_V1, BUY_BOND_ADDRESS_V2, SELL_BOND_ADDRESS_V1, SELL_BOND_ADDRESS_V2, BUY_BOND_ACCOUNT_ABI, SELL_BOND_ACCOUNT_ABI } from '../../constants/bonds.ts';

import type { Hex } from '../../types/blockchain.types.ts';
import type { ExpectedCall, ConfirmationLookupProvider, ConfirmationMismatchReason } from '../types/transactionConfirmationTypes.ts';
import type { BondingTransactionActionSnapshot, BondingTransactionConfirmation, BondingTransactionConfirmationRequest } from '../../features/bonding/bonding.types.ts';

const ERC20_IFACE = new ethers.Interface(erc20Abi);
const BUY_V2_IFACE = new ethers.Interface(BUY_BOND_V2_ABI);
const SELL_V2_IFACE = new ethers.Interface(SELL_BOND_V2_ABI);
const BUY_ACCOUNT_IFACE = new ethers.Interface(BUY_BOND_ACCOUNT_ABI);
const SELL_ACCOUNT_IFACE = new ethers.Interface(SELL_BOND_ACCOUNT_ABI);

/** Re-export for existing tests that inject a provider double. */
export type BondingConfirmationLookupProvider = ConfirmationLookupProvider;

type BondingConfirmationDependencies = {
  getProvider?: () => Promise<ConfirmationLookupProvider>;
};

const MISMATCH_MESSAGES: Record<ConfirmationMismatchReason, string> = {
  sender: 'Bonding transaction sender does not match account.',
  target: 'Bonding transaction target does not match expected contract.',
  calldata: 'Bonding transaction calldata does not match expected action.',
};

/**
 * Fallback confirmation via server Polygon RPC.
 * Maps side/version/kind → fixed contract + calldata; never trusts client addresses.
 * RPC skeleton lives in confirmTransactionOnChain; this file maps the action.
 */
export async function confirmBondingTransaction(
  request: BondingTransactionConfirmationRequest,
  dependencies: BondingConfirmationDependencies = {},
): Promise<BondingTransactionConfirmation> {
  const expected = buildExpectedCall(request.action);

  return confirmTransactionOnChain({
    account: request.account,
    expectedCall: expected,
    transactionHash: request.transactionHash,
    getProvider: dependencies.getProvider ?? getServerPolygonProvider,
    createMismatchError: (reason) =>
      new BondingConfirmationMismatchError(MISMATCH_MESSAGES[reason]),
  });
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
