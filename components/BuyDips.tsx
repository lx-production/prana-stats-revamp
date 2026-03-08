import React, { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../utils/fetchJson';
import { formatStatValue } from '../utils/formatters';

export type BuyDipsJson = {
  total_volume_in_usd?: number;
  total_prana_bought?: number;
  total_buy_transactions?: number;
};

type BuyDipsProps = {
  className?: string;
};

const fallbackBuyDips: BuyDipsJson = {
  total_volume_in_usd: undefined,
  total_prana_bought: undefined,
  total_buy_transactions: undefined,
};

export const BuyDips: React.FC<BuyDipsProps> = ({ className }) => {
  const [data, setData] = useState<BuyDipsJson>(fallbackBuyDips);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const fetchData = async () => {
      try {
        const json = await fetchJson<BuyDipsJson>('/buy_dips.json');
        if (!isActive) return;
        setData({
          total_volume_in_usd: json?.total_volume_in_usd,
          total_prana_bought: json?.total_prana_bought,
          total_buy_transactions: json?.total_buy_transactions,
        });
        setError(null);
      } catch (err: any) {
        if (!isActive) return;
        const message =
          typeof err?.message === 'string' && err.message.trim().length > 0
            ? err.message
            : 'Failed to fetch buy_dips.json';
        setError(message);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isActive = false;
    };
  }, []);

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
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        <a
          href="https://polygonscan.com/token/0x928277e774f34272717eadfafc3fd802dafbd0f5?a=0x1d791aca381c844c4e497fca9429dbe5d36ff1bc"
          target="_blank"
          rel="noreferrer"
          className="text-cyan-300 no-underline hover:text-cyan-200"
        >
          Buy The Dips
        </a>
      </div>
        {error ? (
          <div className="mt-2 text-xs text-red-200">{error}</div>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-md bg-black/30 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">{stat.label}</div>
                <div className="text-xs font-semibold text-gray-100">
                  {isLoading ? 'Loading...' : stat.value}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

export default BuyDips;
