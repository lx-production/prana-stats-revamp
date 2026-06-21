import type { SiteLocale } from '../types/locale.types';

type PranaPerformanceCopy = {
  vsBitcoin: string;
  vsFiat: string;
  periods: {
    m1: string;
    m3: string;
    m6: string;
    y1: string;
    y2: string;
    atl: string;
  };
  loading: string;
};

export const pranaPerformanceCopy: Record<SiteLocale, PranaPerformanceCopy> = {
  en: {
    vsBitcoin: 'PERFORMANCE VS BITCOIN',
    vsFiat: 'PERFORMANCE VS FIAT',
    periods: {
      m1: '1 Month',
      m3: '3 Months',
      m6: '6 Months',
      y1: '1 Year',
      y2: '2 Years',
      atl: 'ATL',
    },
    loading: 'Loading...',
  },
  vi: {
    vsBitcoin: 'HIỆU SUẤT VS BITCOIN',
    vsFiat: 'HIỆU SUẤT VS FIAT',
    periods: {
      m1: '1 THÁNG',
      m3: '3 THÁNG',
      m6: '6 THÁNG',
      y1: '1 NĂM',
      y2: '2 NĂM',
      atl: 'ATL',
    },
    loading: 'Đang tải...',
  },
};
