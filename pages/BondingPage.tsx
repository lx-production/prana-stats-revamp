import React, { useCallback, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Link2,
  ScrollText,
} from 'lucide-react';
import AppFooter from '../components/AppFooter';
import GlassPanel from '../components/ui/GlassPanel';
import LanguageToggle from '../components/LanguageToggle';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import FlutterShaderBackground from '../flutterShader.tsx';
import { formatBondingError } from '../features/bonding/bondingErrors';
import { getBondingCopy } from '../features/bonding/bonding.copy';
import BondingForm from '../features/bonding/components/BondingForm';
import ActiveBonds from '../features/bonding/components/ActiveBonds';
import { useInjectedWallet } from '../features/web3/useInjectedWallet';
import WalletControl from '../features/web3/WalletControl';
import { useBondingConfig } from '../features/bonding/hooks/useBondingConfig';
import { useBondingAccount } from '../features/bonding/hooks/useBondingAccount';
import { POLYGONSCAN_ADDRESS_BASE_URL } from '../constants/network.ts';
import {
  BUY_BOND_ADDRESS_V1,
  BUY_BOND_ADDRESS_V2,
  SELL_BOND_ADDRESS_V1,
  SELL_BOND_ADDRESS_V2,
} from '../constants/bonds.ts';

/**
 * Bonding route shell — wallet, Buy/Sell form, approve/create writes, active bonds.
 * Claim actions land in Bước 6.
 */
export default function BondingPage() {
  const { locale } = useSiteLanguage();
  const copy = getBondingCopy(locale);
  const wallet = useInjectedWallet();

  const configQuery = useBondingConfig();
  const accountQuery = useBondingAccount(
    wallet.isConnected ? wallet.address : undefined,
  );

  // formBusy reserved for claim cross-lock in Bước 6
  const [, setFormBusy] = useState(false);

  const refetchAccount = useCallback(
    () => accountQuery.refetch(),
    [accountQuery.refetch],
  );

  const refetchConfig = useCallback(
    () => configQuery.refetch(),
    [configQuery.refetch],
  );

  usePageMetadata(
    'PRANA Bonding | PRANA Protocol',
    locale === 'en'
      ? 'Buy and sell PRANA bonds on Polygon — official PRANA Protocol bonding page.'
      : 'Mua và bán bond PRANA trên Polygon — trang bonding chính thức của PRANA Protocol.',
  );

  const contractLinks = [
    {
      href: `${POLYGONSCAN_ADDRESS_BASE_URL}/${BUY_BOND_ADDRESS_V1}`,
      label: copy.buyV1ContractLink,
      Icon: ScrollText,
    },
    {
      href: `${POLYGONSCAN_ADDRESS_BASE_URL}/${BUY_BOND_ADDRESS_V2}`,
      label: copy.buyV2ContractLink,
      Icon: Link2,
    },
    {
      href: `${POLYGONSCAN_ADDRESS_BASE_URL}/${SELL_BOND_ADDRESS_V1}`,
      label: copy.sellV1ContractLink,
      Icon: ScrollText,
    },
    {
      href: `${POLYGONSCAN_ADDRESS_BASE_URL}/${SELL_BOND_ADDRESS_V2}`,
      label: copy.sellV2ContractLink,
      Icon: Link2,
    },
  ] as const;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050116] text-white">
      <LanguageToggle />
      <FlutterShaderBackground brightness={0.32} />

      <main className="relative z-10 mx-auto flex max-w-5xl flex-col gap-8 px-4 py-16 sm:max-w-6xl sm:px-6 sm:py-20">
        <header className="space-y-4">
          <div className="space-y-3">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-white/45 transition hover:text-white/80"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {copy.backHome}
            </a>
            <p className="text-sm uppercase tracking-[0.2em] text-white/45">
              PRANA Protocol
            </p>
            <h1 className="text-3xl font-medium tracking-wide sm:text-4xl">
              {copy.pageTitle}
            </h1>
            <p className="max-w-3xl text-[15px] text-white/70">
              {copy.pageSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/50">
            {contractLinks.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 break-all text-cyan-300/90 underline-offset-2 hover:underline"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {label}
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              </a>
            ))}
            {/* Contracts guide route lands in Bước 7 — keep slot for parity with staking. */}
            <span className="inline-flex items-center gap-1 text-white/35">
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {copy.contractsGuideLink}
            </span>
          </div>
        </header>

        <GlassPanel hoverable>
          <WalletControl
            copy={{
              connectWallet: copy.connectWallet,
              disconnect: copy.disconnect,
              switchPolygon: copy.switchPolygon,
              connectedAs: copy.connectedAs,
            }}
            formatError={(err) => formatBondingError(err, locale)}
          />
        </GlassPanel>

        {wallet.isConnected ? (
          <>
            <BondingForm
              config={configQuery.data}
              account={accountQuery.data}
              configLoading={configQuery.isLoading}
              configError={configQuery.isError}
              onBusyChange={setFormBusy}
              refetchAccount={refetchAccount}
              refetchConfig={refetchConfig}
            />
            <ActiveBonds
              bonds={accountQuery.data?.bonds}
              loading={accountQuery.isLoading}
              error={accountQuery.isError}
              blockTimestamp={accountQuery.data?.blockTimestamp}
            />
          </>
        ) : null}
      </main>

      <AppFooter />
    </div>
  );
}
