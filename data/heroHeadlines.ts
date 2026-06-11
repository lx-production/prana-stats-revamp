import type { HeroHeadlines, HeroHeadlinesByLocale } from "../types/heroHeadlines.types";

export const heroHeadlinesByLocale: HeroHeadlinesByLocale = {
  en: {
    title: "Strongest Liquidity",
    subtitle: "Highest Protocol Reserve Ratio",
    tagline:
      "Healthiest Liquidity Density and Protocol Reserve in the entire market",
  },
  vi: {
    title: "Thanh Khoản Mạnh Nhất",
    subtitle: "Tỉ Lệ Dự Trữ Cao Nhất",
    tagline:
      "Sức khỏe thanh khoản và quỹ dự trữ top 1 toàn thị trường",
  },
};

export function formatHeroMessage(headlines: HeroHeadlines): string {
  return `${headlines.title}. ${headlines.subtitle}. ${headlines.tagline}.`;
}
