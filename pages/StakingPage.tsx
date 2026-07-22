import React, { useCallback, useState } from 'react';
import { Coins, ExternalLink, Lock } from 'lucide-react';
import AppFooter from '../components/AppFooter';
import LanguageToggle from '../components/LanguageToggle';
import GlassPanel from '../components/ui/GlassPanel';
import StakingForm from '../features/staking/components/StakingForm';
import ActiveStakes from '../features/staking/components/ActiveStakes';
import WalletControl from '../features/staking/components/WalletControl';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import { useInjectedWallet } from '../features/web3/useInjectedWallet';
import { getStakingCopy } from '../features/staking/staking.copy';
import FlutterShaderBackground from '../flutterShader.tsx';
import { useStakingConfig } from '../features/staking/hooks/useStakingConfig';
import { useStakingAccount } from '../features/staking/hooks/useStakingAccount';
import { POLYGONSCAN_ADDRESS_BASE_URL } from '../constants/network.ts';
import {
  INTEREST_CONTRACT_ADDRESS,
  STAKING_CONTRACT_ADDRESS,
} from '../constants/stakingContracts.ts';

/**
 * Lazy `/stake/` page — dark main-app shell, lower-brightness shader (Bước 6).
 */
export default function StakingPage() {
  const { locale } = useSiteLanguage();
  const copy = getStakingCopy(locale);
  const wallet = useInjectedWallet();

  const configQuery = useStakingConfig();
  const accountQuery = useStakingAccount(
    wallet.isConnected ? wallet.address : undefined,
  );

  const [formBusy, setFormBusy] = useState(false);
  const [actionsBusy, setActionsBusy] = useState(false);

  const refetchAccount = useCallback(
    () => accountQuery.refetch(),
    [accountQuery.refetch],
  );

  usePageMetadata(
    'PRANA Staking | PRANA Protocol',
    locale === 'en'
      ? 'Stake PRANA with fixed APR on Polygon — manage permits, stakes, and claims on the official PRANA Protocol page.'
      : 'Stake PRANA với APR cố định trên Polygon — quản lý permit, stake và claim trên trang chính thức của PRANA Protocol.',
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050116] text-white">
      {/* Dimmer than homepage default (0.5) so form content stays readable */}
      <FlutterShaderBackground brightness={0.32} />

      <main className="relative z-10 mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16 sm:max-w-6xl sm:px-6 sm:py-20">
        <header className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-white/45">
                PRANA Protocol
              </p>
              <h1 className="flex items-center gap-2 text-3xl font-medium tracking-wide sm:text-4xl">
                <Lock className="h-7 w-7 shrink-0 text-[#F5D27A]" aria-hidden />
                {copy.pageTitle}
              </h1>
              <p className="max-w-2xl text-[15px] text-white/70">
                {copy.pageSubtitle}
              </p>
            </div>
            <LanguageToggle placement="inline" />
          </div>

          <nav
            className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center"
            aria-label="Staking page links"
          >
            <a href="/" className="btn-hero btn-glass w-full sm:w-auto">
              {copy.backHome}
            </a>
            <a href="/" className="btn-hero btn-glass w-full sm:w-auto">
              {copy.viewStats}
            </a>
          </nav>

          {/* Compact contract verification links */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/50">
            <a
              href={`${POLYGONSCAN_ADDRESS_BASE_URL}/${STAKING_CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 break-all text-cyan-300/90 underline-offset-2 hover:underline"
            >
              <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {copy.stakingContractLink}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
            <a
              href={`${POLYGONSCAN_ADDRESS_BASE_URL}/${INTEREST_CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 break-all text-cyan-300/90 underline-offset-2 hover:underline"
            >
              {copy.interestContractLink}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          </div>
        </header>

        <GlassPanel hoverable>
          <WalletControl />
        </GlassPanel>

        {wallet.isConnected ? (
          <>
            <StakingForm
              config={configQuery.data}
              account={accountQuery.data}
              configLoading={configQuery.isLoading}
              configError={configQuery.isError}
              refetchAccount={refetchAccount}
              actionsLocked={actionsBusy}
              onBusyChange={setFormBusy}
            />
            <ActiveStakes
              stakes={accountQuery.data?.stakes}
              loading={accountQuery.isLoading}
              error={accountQuery.isError}
              blockTimestamp={accountQuery.data?.blockTimestamp}
              config={configQuery.data}
              configLoading={configQuery.isLoading}
              configError={configQuery.isError}
              refetchAccount={refetchAccount}
              actionsLocked={formBusy}
              onBusyChange={setActionsBusy}
            />
          </>
        ) : null}
      </main>

      <AppFooter />
    </div>
  );
}
