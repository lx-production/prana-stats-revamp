import { useMemo } from 'react';
import { BondProgressValues } from '../types';

export const useBondProgress = ({ committedPercent, capacityPercent }: BondProgressValues) => {
  return useMemo(() => {
    const safeCommittedPercent =
      typeof committedPercent === 'number' && Number.isFinite(committedPercent)
        ? Math.min(100, Math.max(0, committedPercent))
        : 0;
    const safeCapacityPercent =
      typeof capacityPercent === 'number' && Number.isFinite(capacityPercent)
        ? Math.min(100, Math.max(0, capacityPercent))
        : Math.max(0, 100 - safeCommittedPercent);

    return {
      safeCommittedPercent,
      safeCapacityPercent
    };
  }, [committedPercent, capacityPercent]);
};
