import React from 'react';
import { Loader2, LogOut, Wallet } from 'lucide-react';
import StatusBanner from '../../../components/ui/StatusBanner';
import { useInjectedWallet } from '../../web3/useInjectedWallet';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage';
import { formatCompactAddress } from '../../web3/walletFormatting';
import { formatStakingError } from '../stakingErrors';
import { getStakingCopy } from '../staking.copy';

/**
 * Connect / disconnect / switch-Polygon control for the staking page.
 * Reuses the same injected-wallet hook as Swap.
 */
export default function WalletControl() {
  const { locale } = useSiteLanguage();
  const copy = getStakingCopy(locale);
  const wallet = useInjectedWallet();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const onConnect = async () => {
    setError(null);
    setBusy(true);
    try {
      await wallet.connectWallet();
    } catch (err) {
      setError(formatStakingError(err, locale));
    } finally {
      setBusy(false);
    }
  };

  const onSwitchPolygon = async () => {
    setError(null);
    setBusy(true);
    try {
      await wallet.ensurePolygon();
    } catch (err) {
      setError(formatStakingError(err, locale));
    } finally {
      setBusy(false);
    }
  };

  if (!wallet.isConnected) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="btn-hero btn-gold-border inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          onClick={() => void onConnect()}
          disabled={busy || wallet.isConnecting}
        >
          {busy || wallet.isConnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Wallet className="h-4 w-4" aria-hidden />
          )}
          {copy.connectWallet}
        </button>
        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-white/70">
        <span className="text-white/45">{copy.connectedAs}</span>{' '}
        <span className="break-all font-medium text-white">
          {formatCompactAddress(wallet.address ?? '')}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {!wallet.isPolygon ? (
          <button
            type="button"
            className="btn-hero btn-gold-border w-full sm:w-auto"
            onClick={() => void onSwitchPolygon()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {copy.switchPolygon}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => wallet.disconnectWallet()}
          disabled={busy}
          aria-label={`${copy.disconnect} wallet`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/65 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/[0.04] disabled:hover:text-white/65"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          {copy.disconnect}
        </button>
      </div>

      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
    </div>
  );
}
