import React from "react";
import { ArrowLeft } from "lucide-react";
import { getAppBuildInfo } from "../utils/appBuildInfo";
import { useSiteLanguage } from "../hooks/useSiteLanguage";
import { renderMarkdownBody } from "../utils/inlineMarkdown";
import { formatTermsEffectiveDate } from "../utils/formatTermsEffectiveDate";
import { buildIdentityUrl, formatBuildLabel } from "../utils/buildInfoUrls";

import type { LucideIcon } from "lucide-react";
import type { TermsRiskDocument } from "../types/termsRisk.types";

type MarkdownDocumentPageProps = {
  icon: LucideIcon;
  document: TermsRiskDocument;
  metaNote: string;
  /** When set (terms/privacy), shows the effective/updated date line. Guides omit this. */
  effectiveDateIso?: string;
  /** Defaults to “Effective date:” / “Ngày có hiệu lực:”. */
  dateLabel?: string;
};

/**
 * Shared layout for standalone markdown pages (`/terms`, `/privacy`, guides).
 */
const MarkdownDocumentPage: React.FC<MarkdownDocumentPageProps> = ({
  icon: Icon,
  document,
  effectiveDateIso,
  metaNote,
  dateLabel,
}) => {
  const { locale } = useSiteLanguage();
  const buildInfo = getAppBuildInfo();
  const buildLabel = formatBuildLabel(buildInfo);
  const buildHref = buildIdentityUrl(buildInfo);
  // Only format when terms/privacy pass a date; guides skip the date line.
  const effectiveDate = effectiveDateIso
    ? formatTermsEffectiveDate(effectiveDateIso, locale)
    : null;
  const resolvedDateLabel =
    dateLabel ??
    (locale === "en" ? "Effective date: " : "Ngày có hiệu lực: ");
  // Hover shows full SHA even when the label is a release tag.
  const buildTitle = buildInfo.tag
    ? `${buildInfo.tag} (${buildInfo.commit})`
    : buildInfo.commit;

  return (
    <main className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <a
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white/85"
      >
        <ArrowLeft className="h-4 w-4" />
        {locale === "en" ? "Back to home" : "Về trang chủ"}
      </a>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md sm:p-8">
        <div className="mb-6">
          <div className="flex items-start gap-3">
            <Icon className="mt-1 h-5 w-5 shrink-0 text-cyan-300" />
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {document.title}
            </h1>
          </div>

          <aside className="mt-5 space-y-1.5 text-xs leading-relaxed text-white/45 sm:text-sm">
            {effectiveDate ? (
              <p>
                {resolvedDateLabel}
                <span className="text-white/65">{effectiveDate}</span>
              </p>
            ) : null}
            <p>
              {locale === "en" ? "Version: " : "Phiên bản: "}
              {buildHref ? (
                <a
                  href={buildHref}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-white/65 underline-offset-2 hover:text-white/85 hover:underline"
                  title={buildTitle}
                >
                  {buildLabel}
                </a>
              ) : (
                <span className="font-mono text-white/65" title={buildTitle}>
                  {buildLabel}
                </span>
              )}
            </p>
            <p className="pt-1">{metaNote}</p>
          </aside>

          {document.intro ? (
            <div className="mt-5 space-y-3 text-sm leading-relaxed text-slate-300 sm:text-base">
              {renderMarkdownBody(document.intro)}
            </div>
          ) : null}
        </div>

        <div className="space-y-8">
          {document.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-base font-semibold text-white sm:text-lg">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                {renderMarkdownBody(section.body)}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
};

export default MarkdownDocumentPage;
