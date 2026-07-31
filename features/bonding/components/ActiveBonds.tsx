import BondCard from './BondCard.tsx';
import TxLink from '../../../components/ui/TxLink.tsx';
import React, { useEffect, useMemo, useState } from 'react';
import GlassPanel from '../../../components/ui/GlassPanel.tsx';
import StatusBanner from '../../../components/ui/StatusBanner.tsx';

import { Loader2 } from 'lucide-react';
import { getBondingCopy } from '../bonding.copy.ts';
import { useBondActions } from '../hooks/useBondActions.ts';
import { sortActiveBonds } from '../utils/bondingMath.ts';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage.ts';
import { isBondDeploymentPaused } from '../utils/bondClaimTarget.ts';

import type { ActiveBondRecord, BondingConfig } from '../bonding.types.ts';

type ActiveBondsProps = {
  bonds: ActiveBondRecord[] | undefined;
  loading: boolean;
  error: boolean;
  /** Chain block timestamp from the account snapshot when available. */
  blockTimestamp?: number;
  config: BondingConfig | undefined;
  configLoading: boolean;
  configError: boolean;
  refetchAccount: () => Promise<unknown>;
  /** Lock claims while the create/approve form tx is running. */
  actionsLocked?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Lists active bonds and wires claim actions.
 * Wall time = blockTimestamp + elapsed (less dependent on local clock skew).
 * Per-deployment pause only locks bonds on that deployment.
 */
export default function ActiveBonds({
  bonds,
  loading,
  error,
  blockTimestamp,
  config,
  configLoading,
  configError,
  refetchAccount,
  actionsLocked = false,
  onBusyChange,
}: ActiveBondsProps) {
  const { locale } = useSiteLanguage();
  const copy = getBondingCopy(locale);

  const configReady = Boolean(config) && !configLoading && !configError;

  const bondActions = useBondActions({
    config,
    refetchAccount,
    externallyBusy: actionsLocked,
    configReady,
  });

  useEffect(() => {
    onBusyChange?.(bondActions.isBusy);
  }, [onBusyChange, bondActions.isBusy]);

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

        {configLoading ? (
          <StatusBanner tone="neutral">{copy.bondsConfigPending}</StatusBanner>
        ) : null}
        {configError ? (
          <StatusBanner tone="warning">{copy.bondsConfigError}</StatusBanner>
        ) : null}

        {bondActions.error ? (
          <StatusBanner tone="error">{bondActions.error}</StatusBanner>
        ) : null}
        {bondActions.success ? (
          <StatusBanner tone="success">
            {bondActions.success}
            {bondActions.transactionHash ? (
              <>
                {' '}
                <TxLink
                  hash={bondActions.transactionHash}
                  label={copy.viewOnPolygonscan}
                />
              </>
            ) : null}
          </StatusBanner>
        ) : null}
        {bondActions.warning ? (
          <StatusBanner tone="warning">{bondActions.warning}</StatusBanner>
        ) : null}
        {bondActions.hasPendingHash && bondActions.transactionHash ? (
          <StatusBanner tone="warning">
            <div className="space-y-2">
              <div>
                {copy.claimTransactionPending}{' '}
                <TxLink
                  hash={bondActions.transactionHash}
                  label={copy.viewOnPolygonscan}
                />
              </div>
              <button
                type="button"
                className="btn-hero btn-glass w-full sm:w-auto"
                disabled={
                  actionsLocked || bondActions.status === 'confirming'
                }
                onClick={() => void bondActions.resumePendingReceipt()}
              >
                {bondActions.status === 'confirming' ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {copy.confirmingCta}
                  </span>
                ) : (
                  copy.resumeConfirmingCta
                )}
              </button>
            </div>
          </StatusBanner>
        ) : null}

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
          {sortedBonds.map((bond) => {
            const deploymentPaused = config
              ? isBondDeploymentPaused(config.paused, bond.side, bond.version)
              : false;

            return (
              <BondCard
                key={`${bond.side}-${bond.version}-${bond.id}`}
                bond={bond}
                nowSeconds={nowSeconds}
                locale={locale}
                copy={copy}
                actionsEnabled={configReady}
                deploymentPaused={deploymentPaused}
                actionsLocked={actionsLocked || bondActions.isBusy}
                activeClaim={bondActions.action}
                onClaim={(target) => void bondActions.claimBond(target)}
              />
            );
          })}
        </div>
      </div>
    </GlassPanel>
  );
}
