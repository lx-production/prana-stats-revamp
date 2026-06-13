import type { DoublePranaCopyByLocale } from '../types/doublePranaAbsorptionFlow.types';

export const copyByLocale = {
  en: {
    sectionAria: 'Dual PRANA bonding absorption visualization',
    badge: 'Dual PRANA Bonding Effect',
    title: 'Two bonding routes absorb PRANA supply',
    intro:
      '1. Buy side: WBTC enters BuyPranaBondV2, PRANA unlocks slowly, and protocol buybacks remove the repurchased PRANA from circulation forever.\n\n2. Sell side: holders sell PRANA into SellPranaBondV2 and receive WBTC through vesting, while the accepted PRANA leaves circulation forever.',
    buySide: {
      laneTitle: 'Buy side',
      user: { label: 'Buyer', title: 'WBTC enters' },
      contract: { label: 'Contract', title: 'BuyPranaBondV2' },
      vesting: { label: 'Vesting', title: 'PRANA slow unlock' },
      bridgeTitle: 'Protocol buyback buys PRANA from the DEX pool',
      sinkCaption: 'Bought-back PRANA enters the HODL absorption core and never returns to the market.',
      metricLabel: 'Buyback PRANA removed',
      metricTooltip: 'PRANA bought back by the protocol through Buy the Dips.',
    },
    sellSide: {
      laneTitle: 'Sell side',
      user: { label: 'Holder', title: 'Sell PRANA' },
      contract: { label: 'Contract', title: 'SellPranaBondV2' },
      vesting: { label: 'Vesting', title: 'WBTC slow unlock' },
      bridgeTitle: 'Accepted PRANA leaves circulation',
      sinkCaption: 'PRANA accepted by the sell bond enters a second permanent sink and never returns to the market.',
      metricLabel: 'Sell-bond PRANA absorbed',
      metricTooltip: 'PRANA absorbed by SellPranaBondV2 from holders selling into the bond.',
    },
    combinedMetric: {
      label: 'Combined PRANA withdrawn from market',
      tooltip: 'Buyback PRANA plus sell-bond absorbed PRANA.',
    },
    alt: {
      bitcoin: 'Bitcoin token icon',
      prana: 'PRANA token icon',
    },
  },
  vi: {
    sectionAria: 'Minh họa hấp thụ PRANA từ hai nhánh bonding',
    badge: 'Tác động kép PRANA Bonding',
    title: 'Hai nhánh bonding hấp thụ nguồn cung PRANA',
    intro:
      '1. Nhánh mua: WBTC đi vào BuyPranaBondV2, PRANA mở khóa chậm, và protocol mua lại đưa số PRANA đó ra khỏi lưu thông vĩnh viễn.\n\n2. Nhánh bán: người nắm giữ bán PRANA vào SellPranaBondV2 và nhận WBTC qua vesting, trong khi số PRANA được nhận rời khỏi lưu thông vĩnh viễn.',
    buySide: {
      laneTitle: 'Nhánh mua',
      user: { label: 'Người mua', title: 'WBTC đi vào' },
      contract: { label: 'Hợp đồng', title: 'BuyPranaBondV2' },
      vesting: { label: 'Vesting', title: 'PRANA mở khóa chậm' },
      bridgeTitle: 'Protocol mua lại PRANA từ DEX pool',
      sinkCaption: 'PRANA mua lại thông qua "Buy the Dips" đi vào tâm hấp thụ HODL và không bao giờ quay lại thị trường.',
      metricLabel: 'Tổng PRANA Buy-the-Dips',
      metricTooltip: 'PRANA được protocol mua lại qua Buy the Dips.',
    },
    sellSide: {
      laneTitle: 'Nhánh bán',
      user: { label: 'Người giữ', title: 'Bán PRANA' },
      contract: { label: 'Hợp đồng', title: 'SellPranaBondV2' },
      vesting: { label: 'Vesting', title: 'WBTC mở khóa chậm' },
      bridgeTitle: 'PRANA được nhận rời khỏi lưu thông',
      sinkCaption: 'PRANA được SellPranaBondV2 nhận đi vào hố hấp thụ thứ hai và không bao giờ quay lại thị trường.',
      metricLabel: 'Tổng PRANA từ Sell Bonds',
      metricTooltip: 'PRANA được SellPranaBondV2 hấp thụ từ người bán vào bond.',
    },
    combinedMetric: {
      label: 'Tổng PRANA đã rút khỏi thị trường',
      tooltip: 'PRANA mua lại cộng PRANA sell-bond đã hấp thụ.',
    },
    alt: {
      bitcoin: 'Biểu tượng Bitcoin',
      prana: 'Biểu tượng PRANA',
    },
  },
} satisfies DoublePranaCopyByLocale;
