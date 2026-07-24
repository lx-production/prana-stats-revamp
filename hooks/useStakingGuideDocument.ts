import { useMemo } from "react";
import { useSiteLanguage } from "./useSiteLanguage";
import guideStakingEn from "../data/guide-staking-en.md?raw";
import guideStakingVi from "../data/guide-staking-vi.md?raw";
import { parseTermsRiskMarkdown } from "../utils/termsRiskParser";

export function useStakingGuideDocument() {
  const { locale } = useSiteLanguage();
  return useMemo(
    () =>
      parseTermsRiskMarkdown(
        locale === "en" ? guideStakingEn : guideStakingVi,
      ),
    [locale],
  );
}
