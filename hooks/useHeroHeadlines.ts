import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";

export function useHeroHeadlines() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () =>
      locale === "en"
        ? {
            title: "Stake PRANA - 15% APR",
            subtitle: "Simple - Fixed - Transparent.",
            tagline: "Guaranteed by reserves, not by inflation or future users.",
          }
        : {
            title: "Stake PRANA - 15% APR",
            subtitle: "Đơn Giản - Cố Định - Minh Bạch",
            tagline: "Lãi suất được đảm bảo bằng quỹ dự trữ đã phân bổ sẵn, không phải bằng lạm phát hay người mới",
          },
    [locale],
  );
}
