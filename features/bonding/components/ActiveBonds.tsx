import React, { useEffect, useMemo, useState } from 'react';
import GlassPanel from '../../../components/ui/GlassPanel.tsx';
import StatusBanner from '../../../components/ui/StatusBanner.tsx';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { getBondingCopy } from '../bonding.copy.ts';
import { sortActiveBonds } from '../bondingMath.ts';
import BondCard from './BondCard.tsx';

import type { ActiveBondRecord } from '../bonding.types.ts';

type ActiveBondsProps = {
  bonds: ActiveBondRecord[] | undefined;
  loading: boolean;
  error: boolean;
  /** Chain block timestamp from the account snapshot when available. */
  blockTimestamp?: number;
};

/**
 * Lists the connected wallet's active bonds (read-only in Bước 4).
 * Wall time = blockTimestamp + elapsed (less dependent on local clock skew).
 */
export default function ActiveBonds({
  bonds,
  loading,
  error,
  blockTimestamp,
}: ActiveBondsProps) {
  const { locale } = useSiteLanguage();
  const copy = getBondingCopy(locale);

  const [nowSeconds, setNowSeconds] = useState(() =>
    blockTimestamp ?? Math.floor(Date.now() / 1000),
  );

  useEffect(() => {
    if (blockTimestamp != null) {
      setNowSeconds(blockTimestamp);
    }
  }, [blockTimestamp]);

  useEffect(() => {
    const baseWallClock = Date.now();
    const baseChainSeconds = blockTimestamp ?? Math.floor(Date.now() / 1000);

    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - baseWallClock) / 1000);
      setNowSeconds(baseChainSeconds + elapsed);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [blockTimestamp]);

  const sortedBonds = useMemo(
    () => sortActiveBonds(bonds ?? []),
    [bonds],
  );

  return (
    <GlassPanel hoverable>
      <div className="space-y-4">
        <h2 className="text-lg font-medium tracking-wide">
          {copy.activeBondsHeading}
        </h2>

        {loading ? (
          <StatusBanner tone="neutral">{copy.loadingBonds}</StatusBanner>
        ) : null}
        {error ? (
          <StatusBanner tone="error">{copy.accountError}</StatusBanner>
        ) : null}

        {!loading && !error && sortedBonds.length === 0 ? (
          <StatusBanner tone="neutral">{copy.noBonds}</StatusBanner>
        ) : null}

        <div className="space-y-3">
          {sortedBonds.map((bond) => (
            <BondCard
              key={`${bond.side}-${bond.version}-${bond.id}`}
              bond={bond}
              nowSeconds={nowSeconds}
              locale={locale}
              copy={copy}
            />
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}
