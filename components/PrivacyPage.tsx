import React from "react";
import { Shield } from "lucide-react";
import LegalMarkdownPage from "./LegalMarkdownPage";
import { useSiteLanguage } from "../hooks/useSiteLanguage";
import { PRIVACY_EFFECTIVE_DATE } from "../constants/privacy";
import { usePrivacyDocument } from "../hooks/usePrivacyDocument";

/**
 * Standalone Privacy Policy view at `/privacy`.
 */
const PrivacyPage: React.FC = () => {
  const { locale } = useSiteLanguage();
  const privacyDoc = usePrivacyDocument();

  return (
    <LegalMarkdownPage
      icon={Shield}
      document={privacyDoc}
      effectiveDateIso={PRIVACY_EFFECTIVE_DATE}
      metaNote={
        locale === "en"
          ? "This policy describes technical data processing for the current website and PRANA Swap build."
          : "Chính sách này mô tả việc xử lý dữ liệu kỹ thuật cho website và bản PRANA Swap hiện hành."
      }
    />
  );
};

export default PrivacyPage;
