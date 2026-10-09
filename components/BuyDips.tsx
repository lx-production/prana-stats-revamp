import React, { useMemo } from 'react';

import { useBuyDips } from '../hooks/useBuyDips';
import { formatStatValue } from '../utils/formatters';
import { PRANA_ADDRESS } from '../constants/sharedContracts';
import { buildPolygonscanTokenUrl } from '../utils/polygonscanUrls';
import { BUY_DIPS_WALLET_ADDRESSES } from '../constants/protocolAddresses';

type BuyDipsProps = {
  className?: string;
};

export const BuyDips: React.FC<BuyDipsProps> = ({ className }) => {
  const data = useBuyDips();

  const stats = useMemo(
    () => [
      {
        label: 'Volume',
        value: `${formatStatValue(data.total_volume_in_usd)} USD`,
      },
      {
        label: 'PRANA Bought',
        value: `${formatStatValue(data.total_prana_bought)} PRANA`,
      },
      {
        label: 'Transactions',
        value: formatStatValue(data.total_buy_transactions),
      },
    ],
    [data],
  );

  return (
    <div className={className}>
      <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
        <span>Buy The Dips</span>
        {BUY_DIPS_WALLET_ADDRESSES.map((address, index) => (
          <a
            key={address}
            href={buildPolygonscanTokenUrl(PRANA_ADDRESS, { holderAddress: address })}
            target="_blank"
            rel="noreferrer"
            aria-label={`Buy the Dips wallet ${index + 1}`}
            className="ml-1 text-cyan-300 no-underline hover:text-cyan-200"
          >
            ({index + 1})
          </a>
        ))}
      </div>
      {data.error ? (
        <div className="mt-2 text-xs text-red-200">{data.error}</div>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-md px-2 py-1.5 bg-black/30">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">{stat.label}</div>
              <div className="text-[0.65rem] font-semibold text-gray-100">
                {data.isLoading ? 'Loading...' : stat.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BuyDips;
