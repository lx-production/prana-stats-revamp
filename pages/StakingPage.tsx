import React, { useCallback, useState } from 'react';
import AppFooter from '../components/AppFooter';
import LanguageToggle from '../components/LanguageToggle';
import StakingForm from '../features/staking/components/StakingForm';
import ActiveStakes from '../features/staking/components/ActiveStakes';
import WalletControl from '../features/staking/components/WalletControl';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import { useInjectedWallet } from '../hooks/useInjectedWallet';
import { getStakingCopy } from '../features/staking/staking.copy';
import { useStakingConfig } from '../features/staking/hooks/useStakingConfig';
import { useStakingAccount } from '../features/staking/hooks/useStakingAccount';

/**
 * Lazy `/stake/` page — form, account state, and hardened tx flows (Bước 5).
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
      <LanguageToggle />

      <main className="relative z-10 mx-auto flex max-w-5xl flex-col gap-8 px-6 py-20 sm:py-24">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-white/45">
            PRANA Protocol
          </p>
          <h1 className="text-3xl font-medium tracking-wide sm:text-4xl">
            {copy.pageTitle}
          </h1>
          <p className="max-w-2xl text-[15px] text-white/70">
            {copy.pageSubtitle}
          </p>

          <nav
            className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center"
            aria-label="Staking page links"
          >
            <a href="/" className="btn-hero btn-glass">
              {copy.backHome}
            </a>
            <a href="/" className="btn-hero btn-glass">
              {copy.viewStats}
            </a>
          </nav>
        </header>

        <WalletControl />

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
