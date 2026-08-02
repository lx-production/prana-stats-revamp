import { parseUnsignedDecimalRaw } from './parseUnsignedDecimalRaw.ts';
import { StakingApiValidationError } from './stakingQuoteUtils.ts';

import type { Address, Hex } from '../../types/blockchain.types.ts';
import type { StakeActionKind, StakingTransactionActionSnapshot, StakingTransactionConfirmationRequest } from '../../features/staking/staking.types.ts';

/** Sender/target/calldata mismatch — never report as confirmed. */
export class StakingConfirmationMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StakingConfirmationMismatchError';
  }
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const MAX_UINT32 = 0xffff_ffff;

const STAKE_ACTION_KINDS: readonly StakeActionKind[] = [
  'claim',
  'unstake',
  'unstakeEarly',
];

/** uint256 decimal that must be strictly greater than zero. */
function requirePositiveUint256Raw(value: unknown, message: string): bigint {
  const parsed = parseUnsignedDecimalRaw(value);
  if (parsed === null || parsed === 0n) {
    throw new StakingApiValidationError(message);
  }
  return parsed;
}

/** Positive integer (duration / deadline wall-clock seconds). */
function requirePositiveInt(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new StakingApiValidationError(message);
  }
  return value;
}

/** uint8 (EIP-2612 v is typically 27/28). */
function requireUint8(value: unknown, message: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 255
  ) {
    throw new StakingApiValidationError(message);
  }
  return value;
}

/** On-chain stake id — Solidity uint32. */
function requireUint32StakeId(value: unknown, message: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_UINT32
  ) {
    throw new StakingApiValidationError(message);
  }
  return value;
}

export function parseStakingConfirmationRequest(
  body: unknown,
  parseAddress: (value: unknown) => Address | null,
): StakingTransactionConfirmationRequest {
  if (!body || typeof body !== 'object') {
    throw new StakingApiValidationError('Invalid staking confirmation request.');
  }

  const payload = body as Record<string, unknown>;
  if (
    typeof payload.transactionHash !== 'string' ||
    !TX_HASH_RE.test(payload.transactionHash)
  ) {
    throw new StakingApiValidationError('Invalid staking transaction hash.');
  }

  const account = parseAddress(payload.account);
  if (!account) {
    throw new StakingApiValidationError('Invalid staking confirmation account.');
  }

  const action = parseStakingActionSnapshot(payload.action);
  return {
    transactionHash: payload.transactionHash as Hex,
    account,
    action,
  };
}

function parseStakingActionSnapshot(
  value: unknown,
): StakingTransactionActionSnapshot {
  if (!value || typeof value !== 'object') {
    throw new StakingApiValidationError('Invalid staking confirmation action.');
  }

  const action = value as Record<string, unknown>;
  const kind = action.kind;

  if (kind === 'stake') {
    const amountRaw = requirePositiveUint256Raw(
      action.amountRaw,
      'Invalid staking stake amount.',
    );
    const durationSeconds = requirePositiveInt(
      action.durationSeconds,
      'Invalid staking stake duration.',
    );
    const deadline = requirePositiveInt(
      action.deadline,
      'Invalid staking stake deadline.',
    );
    const v = requireUint8(action.v, 'Invalid staking stake signature v.');
    if (typeof action.r !== 'string' || !BYTES32_RE.test(action.r)) {
      throw new StakingApiValidationError('Invalid staking stake signature r.');
    }
    if (typeof action.s !== 'string' || !BYTES32_RE.test(action.s)) {
      throw new StakingApiValidationError('Invalid staking stake signature s.');
    }
    return {
      kind: 'stake',
      amountRaw: amountRaw.toString(),
      durationSeconds,
      deadline,
      v,
      r: action.r as Hex,
      s: action.s as Hex,
    };
  }

  if (
    typeof kind === 'string' &&
    STAKE_ACTION_KINDS.includes(kind as StakeActionKind)
  ) {
    const stakeId = requireUint32StakeId(
      action.stakeId,
      'Invalid staking action stake id.',
    );
    return { kind: kind as StakeActionKind, stakeId };
  }

  throw new StakingApiValidationError('Invalid staking confirmation action.');
}
