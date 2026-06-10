import type { SiteLocale } from "./locale.types";

export type HeroHeadlines = {
  title: string;
  subtitle: string;
  tagline: string;
};

export type HeroHeadlinesByLocale = Record<SiteLocale, HeroHeadlines>;
