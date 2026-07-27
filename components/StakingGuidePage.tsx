import React from "react";
import { LockKeyhole } from "lucide-react";
import MarkdownDocumentPage from "./MarkdownDocumentPage";
import { GUIDE_UPDATED_DATE } from "../constants/guides";
import { useSiteLanguage } from "../hooks/useSiteLanguage";
import { useStakingGuideDocument } from "../hooks/useStakingGuideDocument";

/**
 * Standalone Staking user guide at `/guide/staking/`.
 */
const StakingGuidePage: React.FC = () => {
  const { locale } = useSiteLanguage();
  const guideDoc = useStakingGuideDocument();

  return (
    <MarkdownDocumentPage
      icon={LockKeyhole}
      document={guideDoc}
      effectiveDateIso={GUIDE_UPDATED_DATE}
      dateLabel={locale === "en" ? "Updated: " : "Cập nhật: "}
      metaNote={
        locale === "en"
          ? "Covers the current PRANA Staking flow: Permit & Stake prompts, claim, maturity/grace period, unstake, and early unstake."
          : "Mô tả luồng PRANA Staking hiện tại: hai lời nhắc Permit & Stake, claim, maturity/grace period, unstake, và early unstake."
      }
    />
  );
};

export default StakingGuidePage;
