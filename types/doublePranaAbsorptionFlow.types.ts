import type { SiteLocale } from './locale.types';

export type DoublePranaStepVisual = 'bitcoin' | 'clock' | 'buyback' | 'pranaLock';

export type DoublePranaAltCopy = {
  bitcoin: string;
  prana: string;
};

export type DoublePranaFlowCopy = {
  firstAbsorptionTitle: string;
  secondAbsorptionTitle: string;
  userLabel: string;
  wbtcTitle: string;
  contractLabel: string;
  contractTitle: string;
  bondRoute: string;
  vestingRoute: string;
  vestingLabel: string;
  vestingTitle: string;
  protocolLabel: string;
  protocolTitle: string;
};

export type DoublePranaBlackHoleCopy = {
  outOfCirculation: string;
  sinkTitle: string;
  accretion: string;
  eventHorizon: string;
  caption: string;
  sellBondPranaLabel: string;
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
  flow: DoublePranaFlowCopy;
  blackHole: DoublePranaBlackHoleCopy;
  alt: DoublePranaAltCopy;
};

export type DoublePranaCopyByLocale = Record<SiteLocale, DoublePranaLocaleCopy>;
