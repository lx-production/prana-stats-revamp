import React from 'react';
import InfoTooltip from './InfoTooltip';
import { formatNumber } from '../utils/formatters';
import { Droplets, ShieldCheck } from 'lucide-react';
import { useSiteLanguage } from '../hooks/useSiteLanguage';
import { useLiquidityMetrics } from '../hooks/useLiquidityMetrics';

export const Liquidity: React.FC = () => {
  const { locale } = useSiteLanguage();
  const {
    liquidityDensityPercent,
    protocolCapitalCoveragePercent,
    isLiquidityDensityLoading,
    isProtocolCapitalCoverageLoading,
    error,
  } = useLiquidityMetrics();

  const formattedLiquidityDensity = liquidityDensityPercent === null
    ? null
    : `${formatNumber(liquidityDensityPercent, 2)}%`;
  const formattedProtocolCapitalCoverage = protocolCapitalCoveragePercent === null
    ? null
    : `${formatNumber(protocolCapitalCoveragePercent, 2)}%`;

  const liquidityDensityTooltipAria =
    locale === 'en' ? 'Liquidity Density explanation' : 'Giải thích Liquidity Density';
  const liquidityDensityTooltipText =
    locale === 'en'
      ? 'USD value of WBTC plus PRANA in the WBTC/PRANA DEX Pool, divided by circulating market cap.'
      : 'Giá trị USD của WBTC cộng PRANA trong WBTC/PRANA DEX Pool, chia cho vốn hóa lưu hành.';

  const protocolCapitalCoverageTooltipAria =
    locale === 'en' ? 'Protocol Capital Coverage explanation' : 'Giải thích Protocol Capital Coverage';
  const protocolCapitalCoverageTooltipText =
    locale === 'en'
      ? 'Protocol controlled capital divided by circulating market cap.'
      : 'Vốn do giao thức kiểm soát chia cho vốn hóa lưu hành.';

  const liquidityHealthTooltipAria =
    locale === 'en' ? 'Liquidity Health explanation' : 'Giải thích Sức Khỏe Thanh Khoản';
  const liquidityHealthTooltipText =
    locale === 'en'
      ? 'PRANA has the highest Liquidity Density and Protocol Reserve Ratio across the entire crypto market.'
      : 'PRANA Protocol có Độ dày Thanh khoản và Tỉ lệ Dự trữ cao nhất toàn thị trường crypto.';

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
      <div
        className="
          group relative overflow-visible rounded-2xl border border-white/10 bg-white/5
          backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:bg-white/10
        "
        style={{ animation: 'fadeInUp 0.6s ease-out 0.25s backwards' }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2 relative">
                <Droplets className="w-4 h-4 text-blue-400" />
                {locale === 'en' ? 'Liquidity Health' : 'Sức Khỏe Thanh Khoản'}
                <InfoTooltip
                  ariaLabel={liquidityHealthTooltipAria}
                  text={liquidityHealthTooltipText}
                  positionClassName="top-full mt-2 left-0"
                  widthClassName="w-[min(24rem,calc(100vw-2rem))]"
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 flex items-center justify-center gap-2 relative">
                <Droplets className="w-3.5 h-3.5 text-blue-300" />
                {locale === 'en' ? 'Liquidity Density' : 'Độ dày Thanh khoản'}
                <InfoTooltip
                  ariaLabel={liquidityDensityTooltipAria}
                  text={liquidityDensityTooltipText}
                  positionClassName="top-full mt-2 left-1/2 -translate-x-1/2"
                  widthClassName="w-[min(24rem,calc(100vw-2rem))]"
                />
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#34d96f] text-center">
                {isLiquidityDensityLoading
                  ? 'Loading...'
                  : formattedLiquidityDensity
                    ? `> ${formattedLiquidityDensity}`
                    : '--'}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 flex items-center justify-center gap-2 relative">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
                {locale === 'en' ? 'Protocol Reserve Ratio' : 'Tỉ lệ Dự trữ'}
                <InfoTooltip
                  ariaLabel={protocolCapitalCoverageTooltipAria}
                  text={protocolCapitalCoverageTooltipText}
                  positionClassName="top-full mt-2 left-1/2 -translate-x-1/2"
                  widthClassName="w-[min(24rem,calc(100vw-2rem))]"
                />
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#34d96f] text-center">
                {isProtocolCapitalCoverageLoading
                  ? 'Loading...'
                  : formattedProtocolCapitalCoverage
                    ? `> ${formattedProtocolCapitalCoverage}`
                    : '--'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Liquidity;
