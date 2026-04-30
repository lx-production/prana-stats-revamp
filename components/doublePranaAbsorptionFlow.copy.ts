import type { DoublePranaCopyByLocale } from '../types/doublePranaAbsorptionFlow.types';

export const copyByLocale = {
  en: {
    sectionAria: 'Double PRANA bonding effect visualization',
    badge: 'Dual PRANA Bonding Effect',
    title: 'One WBTC payment creates two supply-side effects',
    intro:
      '1. PRANA is distributed gradually through vesting.\n2. The protocol uses the same paid WBTC to create market buy pressure, then removes the repurchased PRANA from circulation forever.',
    steps: [
      {
        title: '1. Investor buys PRANA bond',
        body:
          'Investor pays WBTC into BuyPranaBondV2 and receive a claim on PRANA, instead of PRANA being released to the market immediately.',
        visual: 'bitcoin',
        accent: 'text-amber-300',
      },
      {
        title: '2. Vested release',
        body:
          'Bonded PRANA unlocks gradually across the selected vesting period, turning the first absorption into a paced emission.',
        visual: 'clock',
        accent: 'text-cyan-300',
      },
      {
        title: '3. Protocol buyback',
        body: 'Protocol uses the received WBTC to directly buy PRANA from the main Uniswap pool.',
        visual: 'buyback',
        accent: 'text-fuchsia-300',
      },
      {
        title: '4. Permanent removal',
        body:
          'Bought-back PRANA crosses the event horizon: out of market circulation forever.',
        visual: 'pranaLock',
        accent: 'text-emerald-300',
      },
    ],
    flow: {
      firstAbsorptionTitle: 'Effect 1',
      secondAbsorptionTitle: 'Effect 2',
      userLabel: 'User',
      wbtcTitle: 'WBTC enters',
      contractLabel: 'Contract',
      contractTitle: 'BuyPranaBondV2',
      bondRoute: 'bond route',
      vestingRoute: 'vested PRANA',
      vestingLabel: 'Vesting',
      vestingTitle: 'Slow unlock',
      protocolLabel: 'Protocol',
      protocolTitle: 'WBTC from the BuyBond contract is used by the Protocol to buy PRANA from the DEX pool',
    },
    blackHole: {
      outOfCirculation: 'Out of circulation',
      sinkTitle: 'Permanent PRANA sink',
      accretion: 'Buyback accretion disk',
      eventHorizon: 'Event horizon',
      caption:
        'PRANA is bought by the Protocol from the DEX pool, enters the HODL absorption core, and never return to the market.',
      sellBondPranaLabel: 'PRANA withdrawn from market',
    },
    alt: {
      bitcoin: 'Bitcoin token icon',
      prana: 'PRANA token icon',
    },
  },
  vi: {
    sectionAria: 'Minh họa dòng tác động kép PRANA Bonding',
    badge: 'Tác động kép PRANA Bonding',
    title: 'Một khoản WBTC tạo ra hai tác động lên nguồn cung',
    intro:
      '1. PRANA được phân phối chậm qua vesting.\n2. Protocol dùng chính WBTC đã trả để tạo lực mua trên thị trường, rồi đưa số PRANA đó ra khỏi lưu thông vĩnh viễn.',
    steps: [
      {
        title: '1. Nhà đầu tư mua PRANA bond',
        body:
          'Nhà đầu tư trả WBTC vào BuyPranaBondV2 và nhận quyền nhận PRANA, thay vì PRANA được đưa ra thị trường ngay lập tức.',
        visual: 'bitcoin',
        accent: 'text-amber-300',
      },
      {
        title: '2. Mở khóa theo vesting',
        body:
          'PRANA từ bond được mở khóa dần theo thời gian đã chọn, biến nhánh hấp thụ đầu tiên thành dòng phát hành có nhịp.',
        visual: 'clock',
        accent: 'text-cyan-300',
      },
      {
        title: '3. Protocol mua lại',
        body:
          'Protocol dùng WBTC đã nhận để mua trực tiếp PRANA từ pool Uniswap chính.',
        visual: 'buyback',
        accent: 'text-fuchsia-300',
      },
      {
        title: '4. Rút khỏi lưu thông',
        body:
          'PRANA được mua lại đi qua chân trời sự kiện: rời khỏi nguồn cung thị trường vĩnh viễn.',
        visual: 'pranaLock',
        accent: 'text-emerald-300',
      },
    ],
    flow: {
      firstAbsorptionTitle: 'Tác động lần 1',
      secondAbsorptionTitle: 'Tác động lần 2',
      userLabel: 'Người dùng',
      wbtcTitle: 'WBTC đi vào',
      contractLabel: 'Hợp đồng',
      contractTitle: 'BuyPranaBondV2',
      bondRoute: 'nhánh bond',
      vestingRoute: 'PRANA vesting',
      vestingLabel: 'Vesting',
      vestingTitle: 'Mở khóa chậm',
      protocolLabel: 'Giao thức',
      protocolTitle: 'WBTC từ hợp đồng BuyBond được Protocol dùng để mua PRANA từ DEX pool',
    },
    blackHole: {
      outOfCirculation: 'Rời khỏi lưu thông',
      sinkTitle: 'Hố hấp thụ PRANA vĩnh viễn',
      accretion: 'Đĩa bồi tụ từ buyback',
      eventHorizon: 'Chân trời sự kiện',
      caption:
        'PRANA được Protocol mua khỏi DEX pool, đi vào tâm hấp thụ HODL và không bao giờ quay lại thị trường.',
      sellBondPranaLabel: 'PRANA đã rút khỏi thị trường',
    },
    alt: {
      bitcoin: 'Biểu tượng Bitcoin',
      prana: 'Biểu tượng PRANA',
    },
  },
} satisfies DoublePranaCopyByLocale;
