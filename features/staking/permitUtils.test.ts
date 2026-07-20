import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getPermitInvalidReason,
  isPermitSnapshotValid,
} from './permitUtils.ts';

import type { Address, Hex } from '../../types/blockchain.types.ts';
import type { PermitSnapshot } from './staking.types.ts';

const OWNER = '0x0000000000000000000000000000000000000001' as Address;
const OTHER = '0x0000000000000000000000000000000000000002' as Address;

function samplePermit(
  overrides: Partial<PermitSnapshot> = {},
): PermitSnapshot {
  return {
    owner: OWNER,
    chainId: 137,
    nonce: '3',
    amountRaw: '1000000000000',
    durationSeconds: 2_592_000,
    deadline: 2_000_000_000,
    v: 27,
    r: ('0x' + '11'.repeat(32)) as Hex,
    s: ('0x' + '22'.repeat(32)) as Hex,
    ...overrides,
  };
}

test('isPermitSnapshotValid requires matching owner/chain/amount/duration and non-expired deadline', () => {
  const permit = samplePermit();
  const base = {
    owner: OWNER,
    chainId: 137,
    amountRaw: '1000000000000',
    durationSeconds: 2_592_000,
    nowSeconds: 1_900_000_000,
  };

  assert.equal(isPermitSnapshotValid(permit, base), true);
  assert.equal(getPermitInvalidReason(permit, base), null);

  assert.equal(
    getPermitInvalidReason(permit, { ...base, nowSeconds: 2_000_000_000 }),
    'expired',
  );
  assert.equal(
    getPermitInvalidReason(permit, { ...base, owner: OTHER }),
    'owner_changed',
  );
  assert.equal(
    getPermitInvalidReason(permit, { ...base, chainId: 1 }),
    'chain_changed',
  );
  assert.equal(
    getPermitInvalidReason(permit, { ...base, amountRaw: '1' }),
    'amount_changed',
  );
  assert.equal(
    getPermitInvalidReason(permit, { ...base, durationSeconds: 86_400 }),
    'duration_changed',
  );
  assert.equal(
    getPermitInvalidReason(permit, { ...base, currentNonce: '99' }),
    'nonce_changed',
  );
  assert.equal(
    getPermitInvalidReason(permit, { ...base, currentNonce: '3' }),
    null,
  );
  assert.equal(getPermitInvalidReason(null, base), 'missing');
});
