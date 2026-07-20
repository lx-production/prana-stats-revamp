import React from "react";
import { Scale } from "lucide-react";
import LegalMarkdownPage from "./LegalMarkdownPage";
import { useSiteLanguage } from "../hooks/useSiteLanguage";
import { TERMS_RISK_EFFECTIVE_DATE } from "../constants/termsRisk";
import { useTermsRiskDocument } from "../hooks/useTermsRiskDocument";

/**
 * Standalone Terms / Risk Disclosure view.
 * Reachable at `/terms` and linked from the site footer + launch posts.
 */
const TermsRiskPage: React.FC = () => {
  const { locale } = useSiteLanguage();
  const termsDoc = useTermsRiskDocument();

  return (
    <LegalMarkdownPage
      icon={Scale}
      document={termsDoc}
      effectiveDateIso={TERMS_RISK_EFFECTIVE_DATE}
      metaNote={
        locale === "en"
          ? "Technical parameters in this document apply only to the current PRANA Swap version as of the update date."
          : "Các thông số kỹ thuật trong tài liệu này chỉ áp dụng cho phiên bản PRANA Swap hiện hành tại ngày cập nhật."
      }
    />
  );
};

export default TermsRiskPage;
