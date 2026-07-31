import { BUY_BOND_ACCOUNT_ABI, BUY_BOND_ADDRESS_V1, BUY_BOND_ADDRESS_V2, SELL_BOND_ACCOUNT_ABI, SELL_BOND_ADDRESS_V1, SELL_BOND_ADDRESS_V2 } from '../../../constants/bonds.ts';

import type { Address } from '../../../types/blockchain.types.ts';
import type { BondAbiFunctionFragment } from '../../../constants/bonds.types.ts';
import type { BondingDeploymentPaused, BondSide, BondVersion } from '../bonding.types.ts';

/** Fixed claim write target resolved from side/version only (never from API/UI address). */
export type BondClaimTarget = {
  address: Address;
  abi: BondAbiFunctionFragment[];
  side: BondSide;
  version: BondVersion;
};

/**
 * Map Buy/Sell × V1/V2 → internal contract address + account ABI.
 * Claim writes must use this mapping so a forged API address cannot redirect the tx.
 */
export function resolveBondClaimTarget(
  side: BondSide,
  version: BondVersion,
): BondClaimTarget {
  if (side === 'buy') {
    return {
      side,
      version,
      address: version === 'v1' ? BUY_BOND_ADDRESS_V1 : BUY_BOND_ADDRESS_V2,
      abi: BUY_BOND_ACCOUNT_ABI,
    };
  }

  return {
    side,
    version,
    address: version === 'v1' ? SELL_BOND_ADDRESS_V1 : SELL_BOND_ADDRESS_V2,
    abi: SELL_BOND_ACCOUNT_ABI,
  };
}

/** Which of the four deployments is paused for this bond. */
export function isBondDeploymentPaused(
  paused: BondingDeploymentPaused,
  side: BondSide,
  version: BondVersion,
): boolean {
  if (side === 'buy') {
    return version === 'v1' ? paused.buyV1 : paused.buyV2;
  }
  return version === 'v1' ? paused.sellV1 : paused.sellV2;
}

/** Stable React / action identity — bond ids can collide across deployments. */
export function bondClaimKey(
  side: BondSide,
  version: BondVersion,
  bondId: string,
): string {
  return `${side}-${version}-${bondId}`;
}
