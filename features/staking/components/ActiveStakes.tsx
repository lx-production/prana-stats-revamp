import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { getStakingCopy } from '../staking.copy.ts';
import StakeCard from './StakeCard.tsx';

import type { StakeRecord } from '../staking.types.ts';

type ActiveStakesProps = {
  stakes: StakeRecord[] | undefined;
  loading: boolean;
  error: boolean;
  /** Chain block timestamp from the account snapshot when available. */
  blockTimestamp?: number;
};

/**
 * Lists the connected wallet's stakes from /api/staking/account.
 * Action buttons (claim / unstake) land in Bước 5.
 */
export default function ActiveStakes({
  stakes,
  loading,
  error,
  blockTimestamp,
}: ActiveStakesProps) {
  const { locale } = useSiteLanguage();
  const copy = getStakingCopy(locale);

  // Prefer chain time when we have it; tick locally so progress updates.
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

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <h2 className="text-lg font-medium tracking-wide text-white">
        {copy.activeStakesHeading}
      </h2>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {copy.loadingStakes}
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {copy.accountError}
        </p>
      ) : !stakes || stakes.length === 0 ? (
        <p className="mt-4 text-sm text-white/55">{copy.noStakes}</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {stakes.map((stake) => (
            <StakeCard
              key={stake.id}
              stake={stake}
              nowSeconds={nowSeconds}
              locale={locale}
              copy={copy}
            />
          ))}
        </div>
      )}
    </section>
  );
}
