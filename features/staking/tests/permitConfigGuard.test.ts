/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRANA_ADDRESS } from '../../../constants/sharedContracts.ts';
import { isPermitConfigPinned } from '../utils/permitConfigGuard.ts';
import {
  INTEREST_CONTRACT_ADDRESS,
  PRANA_PERMIT_DOMAIN_NAME,
  PRANA_PERMIT_DOMAIN_VERSION,
  STAKING_CONTRACT_ADDRESS,
} from '../../../constants/stakingContracts.ts';

import type { Address } from '../../../types/blockchain.types.ts';
import type { PermitConfigPinCheck } from '../utils/permitConfigGuard.types.ts';

const OTHER = '0x0000000000000000000000000000000000000001' as Address;

function sampleConfig(
  overrides: Partial<PermitConfigPinCheck> = {},
): PermitConfigPinCheck {
  return {
    contracts: {
      prana: PRANA_ADDRESS,
      staking: STAKING_CONTRACT_ADDRESS,
      interest: INTEREST_CONTRACT_ADDRESS,
      ...overrides.contracts,
    },
    permitDomain: {
      name: PRANA_PERMIT_DOMAIN_NAME,
      version: PRANA_PERMIT_DOMAIN_VERSION,
      ...overrides.permitDomain,
    },
  };
}

test('isPermitConfigPinned accepts matching API contracts and permit domain', () => {
  assert.equal(isPermitConfigPinned(sampleConfig()), true);

  // Address compare is case-insensitive.
  assert.equal(
    isPermitConfigPinned(
      sampleConfig({
        contracts: {
          prana: PRANA_ADDRESS.toLowerCase() as Address,
          staking: STAKING_CONTRACT_ADDRESS.toUpperCase() as Address,
          interest: INTEREST_CONTRACT_ADDRESS,
        },
      }),
    ),
    true,
  );
});

test('isPermitConfigPinned rejects wrong PRANA verifying contract', () => {
  assert.equal(
    isPermitConfigPinned(
      sampleConfig({
        contracts: {
          prana: OTHER,
          staking: STAKING_CONTRACT_ADDRESS,
          interest: INTEREST_CONTRACT_ADDRESS,
        },
      }),
    ),
    false,
  );
});

test('isPermitConfigPinned rejects wrong staking spender', () => {
  assert.equal(
    isPermitConfigPinned(
      sampleConfig({
        contracts: {
          prana: PRANA_ADDRESS,
          staking: OTHER,
          interest: INTEREST_CONTRACT_ADDRESS,
        },
      }),
    ),
    false,
  );
});

test('isPermitConfigPinned rejects permit domain name or version drift', () => {
  assert.equal(
    isPermitConfigPinned(
      sampleConfig({
        permitDomain: {
          name: 'WrongToken' as typeof PRANA_PERMIT_DOMAIN_NAME,
          version: PRANA_PERMIT_DOMAIN_VERSION,
        },
      }),
    ),
    false,
  );

  assert.equal(
    isPermitConfigPinned(
      sampleConfig({
        permitDomain: {
          name: PRANA_PERMIT_DOMAIN_NAME,
          version: '99' as typeof PRANA_PERMIT_DOMAIN_VERSION,
        },
      }),
    ),
    false,
  );
});
