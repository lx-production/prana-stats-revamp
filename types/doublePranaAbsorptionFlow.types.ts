import type { SiteLocale } from './locale.types';

export type DoublePranaStepVisual = 'bitcoin' | 'clock' | 'buyback' | 'pranaLock' | 'sellBond';

export type DoublePranaAltCopy = {
  bitcoin: string;
  prana: string;
};

export type DoublePranaNodeCopy = {
  label: string;
  title: string;
};

export type DoublePranaSideCopy = {
  laneTitle: string;
  user: DoublePranaNodeCopy;
  contract: DoublePranaNodeCopy;
  vesting: DoublePranaNodeCopy;
  bridgeTitle: string;
  sinkCaption: string;
  metricLabel: string;
  metricTooltip: string;
};

export type DoublePranaCombinedMetricCopy = {
  label: string;
  tooltip: string;
};

export type DoublePranaStepCopy = {
  title: string;
  body: string;
  visual: DoublePranaStepVisual;
  accent: string;
};

export type DoublePranaLocaleCopy = {
  sectionAria: string;
  badge: string;
  title: string;
  intro: string;
  steps: DoublePranaStepCopy[];
  buySide: DoublePranaSideCopy;
  sellSide: DoublePranaSideCopy;
  combinedMetric: DoublePranaCombinedMetricCopy;
  alt: DoublePranaAltCopy;
};

export type DoublePranaCopyByLocale = Record<SiteLocale, DoublePranaLocaleCopy>;
