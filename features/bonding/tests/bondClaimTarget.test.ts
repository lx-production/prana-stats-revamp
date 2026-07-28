/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BUY_BOND_ADDRESS_V1,
  BUY_BOND_ADDRESS_V2,
  SELL_BOND_ADDRESS_V1,
  SELL_BOND_ADDRESS_V2,
} from '../../../constants/bonds.ts';
import {
  bondClaimKey,
  isBondDeploymentPaused,
  resolveBondClaimTarget,
} from '../utils/bondClaimTarget.ts';

import type { BondingDeploymentPaused } from '../bonding.types.ts';

test('resolveBondClaimTarget maps side/version to fixed internal addresses', () => {
  assert.equal(
    resolveBondClaimTarget('buy', 'v1').address,
    BUY_BOND_ADDRESS_V1,
  );
  assert.equal(
    resolveBondClaimTarget('buy', 'v2').address,
    BUY_BOND_ADDRESS_V2,
  );
  assert.equal(
    resolveBondClaimTarget('sell', 'v1').address,
    SELL_BOND_ADDRESS_V1,
  );
  assert.equal(
    resolveBondClaimTarget('sell', 'v2').address,
    SELL_BOND_ADDRESS_V2,
  );

  // ABI always includes claimBond; create functions are never required for claim.
  for (const side of ['buy', 'sell'] as const) {
    for (const version of ['v1', 'v2'] as const) {
      const target = resolveBondClaimTarget(side, version);
      assert.equal(
        target.abi.some((f) => f.name === 'claimBond'),
        true,
      );
      assert.equal(target.side, side);
      assert.equal(target.version, version);
    }
  }
});

test('resolveBondClaimTarget ignores any forged address input by not accepting one', () => {
  // Function signature is side+version only — there is no address parameter.
  const forged = '0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef';
  const target = resolveBondClaimTarget('buy', 'v1');
  assert.notEqual(target.address.toLowerCase(), forged.toLowerCase());
  assert.equal(target.address, BUY_BOND_ADDRESS_V1);
});

test('isBondDeploymentPaused isolates each of the four deployments', () => {
  const paused: BondingDeploymentPaused = {
    buyV1: true,
    buyV2: false,
    sellV1: false,
    sellV2: true,
  };

  assert.equal(isBondDeploymentPaused(paused, 'buy', 'v1'), true);
  assert.equal(isBondDeploymentPaused(paused, 'buy', 'v2'), false);
  assert.equal(isBondDeploymentPaused(paused, 'sell', 'v1'), false);
  assert.equal(isBondDeploymentPaused(paused, 'sell', 'v2'), true);
});

test('bondClaimKey distinguishes colliding ids across deployments', () => {
  assert.notEqual(
    bondClaimKey('buy', 'v1', '1'),
    bondClaimKey('buy', 'v2', '1'),
  );
  assert.notEqual(
    bondClaimKey('buy', 'v2', '1'),
    bondClaimKey('sell', 'v2', '1'),
  );
  assert.equal(bondClaimKey('sell', 'v1', '42'), 'sell-v1-42');
});
