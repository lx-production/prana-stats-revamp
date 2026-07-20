import React from 'react';
import { Loader2, LogOut, Wallet } from 'lucide-react';
import { useInjectedWallet } from '../../../hooks/useInjectedWallet';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage';
import { formatCompactAddress } from '../../../utils/swapTokenFormatting';
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
      setError(err instanceof Error ? err.message : copy.connectWallet);
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
      setError(err instanceof Error ? err.message : copy.switchPolygon);
    } finally {
      setBusy(false);
    }
  };

  if (!wallet.isConnected) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="btn-hero btn-gold-border inline-flex items-center gap-2"
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
        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-white/70">
        <span className="text-white/45">{copy.connectedAs}</span>{' '}
        <span className="font-medium text-white">
          {formatCompactAddress(wallet.address ?? '')}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {!wallet.isPolygon ? (
          <button
            type="button"
            className="btn-hero btn-gold-border"
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
          className="btn-hero btn-glass inline-flex items-center justify-center gap-2"
          onClick={() => wallet.disconnectWallet()}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {copy.disconnect}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-300 sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
