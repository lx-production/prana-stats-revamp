import React, { useMemo } from 'react';
import { useBuyDips } from '../hooks/useBuyDips';
import { formatStatValue } from '../utils/formatters';
import { PRANA_ADDRESS } from '../constants/sharedContracts';
import { BUY_DIPS_WALLET_ADDRESS } from '../constants/protocolAddresses';
import { buildPolygonscanTokenUrl } from '../utils/polygonscanUrls';

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

  const buyDipsExplorerUrl = buildPolygonscanTokenUrl(PRANA_ADDRESS, {
    holderAddress: BUY_DIPS_WALLET_ADDRESS,
  });

  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        <a
          href={buyDipsExplorerUrl}
          target="_blank"
          rel="noreferrer"
          className="text-cyan-300 no-underline hover:text-cyan-200"
        >
          Buy The Dips
        </a>
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
