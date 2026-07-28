import React from 'react';
import SharedWalletControl from '../../web3/WalletControl';
import { useSiteLanguage } from '../../../hooks/useSiteLanguage';
import { formatStakingError } from '../stakingErrors';
import { getStakingCopy } from '../staking.copy';

/**
 * Staking wrapper: injects staking copy + error formatter into shared WalletControl.
 */
export default function WalletControl() {
  const { locale } = useSiteLanguage();
  const copy = getStakingCopy(locale);

  return (
    <SharedWalletControl
      copy={{
        connectWallet: copy.connectWallet,
        disconnect: copy.disconnect,
        switchPolygon: copy.switchPolygon,
        connectedAs: copy.connectedAs,
      }}
      formatError={(err) => formatStakingError(err, locale)}
    />
  );
}
