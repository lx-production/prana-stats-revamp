import React from 'react';
import SatsPriceChart from './SatsPriceChart';
import PranaVndPriceChart from './PranaVndPriceChart';
import { usePranaStats } from '../hooks/usePranaStats';

const PriceChartsSection: React.FC = () => {
  const { usdToVndRate } = usePranaStats();

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <SatsPriceChart />
        <PranaVndPriceChart usdToVndRate={usdToVndRate} />
      </div>
    </section>
  );
};

export default PriceChartsSection;
