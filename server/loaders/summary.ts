import path from 'node:path';
import { loadPranaPricesBundle } from './pranaPrices.ts';
import { loadBondMetrics } from './bondMetrics.ts';
import { loadCachedCapital } from './capitalCached.ts';
import { loadCachedLpCapital } from './lpCapitalCached.ts';
import { loadCachedStakingStats } from './stakingStatsCached.ts';
import { loadCachedTopHoldingAddresses } from './topHoldingAddresses.ts';
import { PROJECT_ROOT } from '../projectRoot.ts';
import { readJsonIfExists } from '../../utils/jsonHelper.ts';
import { parseFaqMarkdown } from '../../utils/faqParser.ts';
import { TIMELINE_COPY_EN } from '../../data/timelineCopy.ts';
import { TIMELINE_EVENTS_META } from '../../data/timelineEventsMeta.ts';
import { computeProtocolCapitalUsd } from '../../utils/protocolCapital.ts';
import { copyByLocale } from '../../components/doublePranaAbsorptionFlow.copy.ts';
import { computeSupplyMetrics, PRANA_TOTAL_SUPPLY } from '../../utils/supplyMetrics.ts';
import { buildBtcPriceChange, buildFiatPriceChangeFrom365 } from '../../utils/pranaStatsPerformance.ts';
import { computeLiquidityMetrics, getDexPoolPranaAmount, getDexPoolWbtcUsdValue, SATS_PER_BTC } from '../../utils/liquidityMetrics.ts';
import { formatDate as formatUnixDate, formatNumber, formatPercent, formatSats, formatUsd, formatVnd } from '../../utils/formatters.ts';
import { mdList, mdNumbered, mdQuestions, normalizeOrigin, readMarkdownData, readPricePointSeries, toFiniteNumber } from './summaryUtils.ts';
import type { BuyDipsJson } from '../../types/buyDips.types.ts';
import type { PriceChangeSet } from '../../types/performance.ts';

function formatPerformanceSet(priceChange: PriceChangeSet): string {
  return mdList([
    `1 month: ${formatPercent(priceChange.m1, 0)}`,
    `3 months: ${formatPercent(priceChange.m3, 0)}`,
    `6 months: ${formatPercent(priceChange.m6, 0)}`,
    `1 year: ${formatPercent(priceChange.y1, 0)}`,
    `From ATL: ${formatPercent(priceChange.atl, 0)}`,
  ]);
}

export async function loadSummaryMarkdown(options: { origin?: string } = {}): Promise<string> {
  const origin = normalizeOrigin(options.origin ?? 'https://prana.triethocduongpho.net');
  const doublePranaCopy = copyByLocale.en;

  const [
    prices,
    stakingStats,
    capital,
    lpCapital,
    bondMetrics,
    topHoldingAddresses,
    buyDips,
    d365,
    faqMarkdown,
    covenantsMarkdown,
  ] = await Promise.all([
    loadPranaPricesBundle(),
    loadCachedStakingStats(),
    loadCachedCapital(),
    loadCachedLpCapital(),
    loadBondMetrics(),
    loadCachedTopHoldingAddresses(),
    readJsonIfExists<BuyDipsJson>(path.join(PROJECT_ROOT, 'buy_dips.json')),
    readPricePointSeries('data_365_days.json'),
    readMarkdownData('faq-en.md'),
    readMarkdownData('covenants-en.md'),
  ]);

  const pranaUsdPrice = (prices.latestSatPrice / SATS_PER_BTC) * prices.btcPriceUsd;
  const pranaVndPrice = (prices.latestSatPrice / SATS_PER_BTC) * prices.btcPriceVnd;
  const marketCapVnd = Math.round(pranaVndPrice * PRANA_TOTAL_SUPPLY);
  const protocolCapitalUsd = computeProtocolCapitalUsd(capital.items, lpCapital.usdValueNumber);
  const supply = computeSupplyMetrics(topHoldingAddresses.holders, bondMetrics.summary.buyBondCapacityDisplay);
  const liquidity = computeLiquidityMetrics({
    btcPriceUsd: prices.btcPriceUsd,
    latestSatPrice: prices.latestSatPrice,
    circulatingSupply: supply.circulatingSupply,
    dexPoolPranaAmount: getDexPoolPranaAmount(topHoldingAddresses.holders),
    dexPoolWbtcUsdValue: getDexPoolWbtcUsdValue(capital.items),
    protocolCapitalUsd,
  });
  const fiatPerformance = buildFiatPriceChangeFrom365({
    btcPriceUsd: prices.btcPriceUsd,
    latestSatPrice: prices.latestSatPrice,
    d365,
  });
  const btcPerformance = buildBtcPriceChange(prices.latestSatPrice, prices.satsData);
  const totalWithdrawnPrana = bondMetrics.summary.sellBondPrana === null
    ? null
    : bondMetrics.summary.sellBondPrana + toFiniteNumber(buyDips?.total_prana_bought);
  const faqItems = parseFaqMarkdown(faqMarkdown);
  const covenantItems = parseFaqMarkdown(covenantsMarkdown);
  const timelineEvents = TIMELINE_EVENTS_META.map((meta) => ({
    ...meta,
    ...TIMELINE_COPY_EN[meta.id],
  }));

  return [
    '# PRANA Stats Summary',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Canonical site: ${origin}`,
    '',
    '## Overview',
    '',
    mdList([
      'PRANA is designed around Bitcoin-denominated value, fixed supply, transparent on-chain liquidity, staking, bonding, and protocol-level buy-the-dips behavior.',
      'Hero message: Stake with 15% APR. Simple - Fixed - Transparent. Guaranteed by reserves, not by inflation or future users.',
      `Primary actions: Stake (${origin}/stake/), Bond (${origin}/bond/), Trade (https://app.uniswap.org/explore/pools/polygon/0xf9A9Fce44AC9E68D7e0B87516fE21536446B1AED).`,
    ]),
    '',
    '## Current Market Stats',
    '',
    mdList([
      `BTC price: ${formatUsd(prices.btcPriceUsd)} / ${formatVnd(prices.btcPriceVnd)}`,
      `USD/VND rate: ${formatNumber(prices.usdToVndRate, 2)}`,
      `PRANA price: ${formatNumber(prices.latestSatPrice, 2)} SAT / ${formatUsd(pranaUsdPrice)} / ${formatVnd(pranaVndPrice)}`,
      `Fully diluted valuation: ${formatVnd(marketCapVnd)}`,
    ]),
    '',
    '## Performance',
    '',
    'Against Bitcoin:',
    '',
    formatPerformanceSet(btcPerformance),
    '',
    'Against fiat:',
    '',
    formatPerformanceSet(fiatPerformance),
    '',
    '## Staking',
    '',
    mdList([
      'Headline APR: 15% fixed APR for the 1-year term.',
      `Staked PRANA: ${formatNumber(toFiniteNumber(stakingStats.stakedPrana))} PRANA (${formatVnd(stakingStats.stakedVnd)})`,
      `Interest contract balance: ${formatNumber(toFiniteNumber(stakingStats.interestContractBalancePrana))} PRANA (${formatVnd(stakingStats.interestContractBalanceVnd)})`,
      `Total interest: ${formatNumber(toFiniteNumber(stakingStats.interestPrana))} PRANA (${formatVnd(stakingStats.interestVnd)})`,
      `Claimable unclaimed interest: ${formatNumber(toFiniteNumber(stakingStats.claimableUnclaimedInterestPrana))} PRANA`,
      `Daily interest: ${formatNumber(toFiniteNumber(stakingStats.dailyInterestPrana))} PRANA`,
      `Surplus runway remaining: ${stakingStats.surplusRunwayRemainingDays === null ? 'N/A' : `${formatNumber(stakingStats.surplusRunwayRemainingDays)} days`}`,
    ]),
    '',
    '## Bonding',
    '',
    mdList([
      `Total Buy Bonds Volume: ${formatNumber(toFiniteNumber(bondMetrics.summary.buyBondPrana))} PRANA (${formatVnd(bondMetrics.summary.buyBondVnd)})`,
      `Total Sell Bonds Volume: ${formatNumber(toFiniteNumber(bondMetrics.summary.sellBondPrana))} PRANA (${formatVnd(bondMetrics.summary.sellBondVnd)})`,
      `Buy bond committed: ${bondMetrics.summary.buyBondCommittedDisplay ?? 'N/A'} PRANA (${formatPercent(bondMetrics.summary.buyBondCommittedPercent)})`,
      `Buy bond capacity: ${bondMetrics.summary.buyBondCapacityDisplay ?? 'N/A'} PRANA (${formatPercent(bondMetrics.summary.buyBondCapacityPercent)})`,
      `Sell bond committed: ${bondMetrics.summary.sellBondCommittedDisplay ?? 'N/A'} WBTC (${formatPercent(bondMetrics.summary.sellBondCommittedPercent)})`,
      `Sell bond capacity: ${formatSats(bondMetrics.summary.sellBondCapacityDisplay)} (${formatPercent(bondMetrics.summary.sellBondCapacityPercent)})`,
    ]),
    '',
    '## Protocol Controlled Capital',
    '',
    mdList([
      `Total protocol controlled non-native capital: ${formatUsd(protocolCapitalUsd)}`,
      ...capital.items.map((item) => `${item.network} ${item.tokenSymbol}: ${item.amount} ${item.tokenSymbol} at ${item.address}${item.usdValue ? ` (${item.usdValue})` : ''}`),
      `Arbitrum WBTC/USDT LP: ${lpCapital.usdValue}; 24h APR: ${lpCapital.apr24hLabel ?? 'N/A'}; active positions: ${lpCapital.activePositionsCount}; position IDs: ${lpCapital.positionIds.join(', ') || 'N/A'}`,
    ]),
    '',
    '## Liquidity And Supply',
    '',
    mdList([
      `Total max supply: ${formatNumber(PRANA_TOTAL_SUPPLY)} PRANA`,
      `Circulating supply: ${formatNumber(supply.circulatingSupply)} PRANA`,
      `Buyable supply: ${formatNumber(supply.buyableSupply)} PRANA`,
      `Liquidity density: > ${formatPercent(liquidity.liquidityDensityPercent)}`,
      'Liquidity density means the USD value of WBTC plus PRANA in the WBTC/PRANA DEX Pool, divided by circulating market cap.',
      `Protocol reserve ratio: > ${formatPercent(liquidity.protocolCapitalCoveragePercent)}`,
      'Protocol reserve ratio means protocol controlled capital divided by circulating market cap.',
      'Circulating supply means max supply less PRANA in HODL wallets; lost PRANA is not subtracted.',
      'Buyable supply means PRANA in the WBTC/PRANA DEX pool, DEX Pool & Bonds Reserve, and BuyBond capacity.',
    ]),
    '',
    '## Top Holding Addresses',
    '',
    `Generated at: ${topHoldingAddresses.generatedAt}`,
    '',
    mdList(topHoldingAddresses.holders.map((holder, index) => `${index + 1}. ${holder.label}: ${formatNumber(toFiniteNumber(holder.balance))} PRANA at ${holder.address}`)),
    '',
    '## Double PRANA Bonding Effect',
    '',
    `**${doublePranaCopy.title}**`,
    '',
    doublePranaCopy.intro,
    '',
    mdNumbered(doublePranaCopy.steps),
    '',
    mdList([
      doublePranaCopy.blackHole.caption,
      `${doublePranaCopy.blackHole.sellBondPranaLabel}: ${totalWithdrawnPrana === null ? 'N/A' : `${formatNumber(totalWithdrawnPrana)} PRANA`}`,
      `Buy the Dips volume: ${formatUsd(buyDips?.total_volume_in_usd)}; PRANA bought: ${formatNumber(toFiniteNumber(buyDips?.total_prana_bought))}; transactions: ${formatNumber(toFiniteNumber(buyDips?.total_buy_transactions))}`,
    ]),
    '',
    '## Timeline',
    '',
    mdList(timelineEvents.map((event) => {
      const link = 'link' in event ? event.link : undefined;
      return `${formatUnixDate(event.timestamp)} - ${event.title}: ${event.description}${link ? ` (${link})` : ''}`;
    })),
    '',
    '## Covenants',
    '',
    mdQuestions(covenantItems),
    '',
    '## FAQ',
    '',
    mdQuestions(faqItems),
    '',
    '## Raw Data Endpoints',
    '',
    mdList([
      `${origin}/api/prana-stats`,
      `${origin}/api/staking-stats`,
      `${origin}/api/capital`,
      `${origin}/api/lp-capital`,
      `${origin}/api/bond-metrics`,
      `${origin}/api/top-holding-addresses`,
      `${origin}/data_30_days.json - PRANA USD price history for the last 30 days.`,
      `${origin}/data_90_days.json - PRANA USD price history for the last 90 days.`,
      `${origin}/data_180_days.json - PRANA USD price history for the last 180 days.`,
      `${origin}/data_365_days.json - PRANA USD price history for the last 365 days.`,
      `${origin}/data_max.json - PRANA USD price history for the full available range.`,
      `${origin}/data_sats.json - PRANA SAT price history.`,
      `${origin}/bonds_v2.json`,
      `${origin}/buy_dips.json`,
    ]),
    '',
  ].join('\n');
}
