import type { DoublePranaCopyByLocale } from '../types/doublePranaAbsorptionFlow.types';

export const copyByLocale = {
  en: {
    sectionAria: 'Dual PRANA bonding absorption visualization',
    badge: 'Dual PRANA Bonding Effect',
    title: 'Two bonding routes absorb PRANA supply',
    intro:
      '1. Buy side: WBTC enters BuyPranaBondV2, PRANA unlocks slowly, and protocol buybacks remove the repurchased PRANA from circulation forever.\n\n2. Sell side: holders sell PRANA into SellPranaBondV2 and receive WBTC through vesting, while the accepted PRANA leaves circulation forever.',
    steps: [
      {
        title: '1. Buy PRANA bond',
        body:
          'Investor pays WBTC into BuyPranaBondV2 and receives a claim on PRANA, instead of PRANA being released to the market immediately.',
        visual: 'bitcoin',
        accent: 'text-amber-300',
      },
      {
        title: '2. Vested PRANA release',
        body:
          'Bonded PRANA unlocks gradually across the selected vesting period, turning the absorption into a slow emission.',
        visual: 'clock',
        accent: 'text-cyan-300',
      },
      {
        title: '3. Buyback into permanent sink',
        body:
          'Protocol uses the received WBTC to buy PRANA from the Uniswap pool, then removes it from circulation forever.',
        visual: 'pranaLock',
        accent: 'text-fuchsia-300',
      },
      {
        title: '4. Sell PRANA bond',
        body:
          'A holder sells PRANA into SellPranaBondV2, which absorbs the PRANA instead of letting it hit the open market.',
        visual: 'sellBond',
        accent: 'text-emerald-300',
      },
      {
        title: '5. Vested WBTC release',
        body:
          'The seller receives WBTC gradually across the vesting period.',
        visual: 'clock',
        accent: 'text-cyan-300',
      },
      {
        title: '6. Permanent absorption',
        body:
          'PRANA accepted by SellPranaBondV2 crosses the event horizon: out of market circulation forever.',
        visual: 'pranaLock',
        accent: 'text-emerald-300',
      },
    ],
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
    steps: [
      {
        title: '1. Mua PRANA bond',
        body:
          'Nhà đầu tư trả WBTC vào BuyPranaBondV2 và nhận quyền nhận PRANA, thay vì PRANA được đưa ra thị trường ngay lập tức.',
        visual: 'bitcoin',
        accent: 'text-amber-300',
      },
      {
        title: '2. Mở khóa PRANA theo vesting',
        body:
          'PRANA từ bond được mở khóa dần theo thời gian đã chọn, biến nhánh hấp thụ thành dòng phát hành chậm rãi.',
        visual: 'clock',
        accent: 'text-cyan-300',
      },
      {
        title: '3. Mua lại đưa vào hố đen HODL',
        body:
          'Protocol dùng WBTC đã nhận để mua PRANA từ pool Uniswap, rồi đưa số đó ra khỏi lưu thông vĩnh viễn.',
        visual: 'pranaLock',
        accent: 'text-fuchsia-300',
      },
      {
        title: '4. Bán PRANA bond',
        body:
          'Người nắm giữ bán PRANA vào SellPranaBondV2, hợp đồng hấp thụ số PRANA đó thay vì để nó ra thị trường mở.',
        visual: 'sellBond',
        accent: 'text-emerald-300',
      },
      {
        title: '5. Mở khóa WBTC theo vesting',
        body:
          'Người bán nhận WBTC dần theo thời gian vesting.',
        visual: 'clock',
        accent: 'text-cyan-300',
      },
      {
        title: '6. Hấp thụ vĩnh viễn',
        body:
          'PRANA được SellPranaBondV2 nhận đi qua chân trời sự kiện: rời khỏi nguồn cung thị trường vĩnh viễn.',
        visual: 'pranaLock',
        accent: 'text-emerald-300',
      },
    ],
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
