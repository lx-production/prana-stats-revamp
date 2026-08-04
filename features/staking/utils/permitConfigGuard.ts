import { PRANA_ADDRESS } from '../../../constants/sharedContracts.ts';
import { PRANA_PERMIT_DOMAIN_NAME, PRANA_PERMIT_DOMAIN_VERSION, STAKING_CONTRACT_ADDRESS } from '../../../constants/stakingContracts.ts';

import type { PermitConfigPinCheck } from './permitConfigGuard.types.ts';

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * True when API permit fields match the browser's hardcoded constants.
 * Fail closed before signTypedData so a poisoned config cannot change
 * verifyingContract, spender, or EIP-712 domain name/version.
 */
export function isPermitConfigPinned(config: PermitConfigPinCheck): boolean {
  return (
    sameAddress(config.contracts.prana, PRANA_ADDRESS) &&
    sameAddress(config.contracts.staking, STAKING_CONTRACT_ADDRESS) &&
    config.permitDomain.name === PRANA_PERMIT_DOMAIN_NAME &&
    config.permitDomain.version === PRANA_PERMIT_DOMAIN_VERSION
  );
}
