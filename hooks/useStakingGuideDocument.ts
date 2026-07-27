import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import guideStakingEn from "../data/guide-staking-en.md?raw";
import guideStakingVi from "../data/guide-staking-vi.md?raw";
import { parseSectionedMarkdown } from "../utils/parseSectionedMarkdown";

export function useStakingGuideDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () =>
      parseSectionedMarkdown(
        locale === "en" ? guideStakingEn : guideStakingVi,
      ),
    [locale],
  );
}
