import type { StakingConfig } from '../staking.types.ts';

/** Config slice checked before EIP-712 permit signing. */
export type PermitConfigPinCheck = {
  contracts: StakingConfig['contracts'];
  permitDomain: StakingConfig['permitDomain'];
};
