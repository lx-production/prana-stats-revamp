import React from "react";
import { ArrowLeft, Scale } from "lucide-react";
import { useSiteLanguage } from "../hooks/useSiteLanguage";
import { renderInlineMarkdown } from "../utils/inlineMarkdown";
import { useTermsRiskDocument } from "../hooks/useTermsRiskDocument";

/**
 * Standalone Terms / Risk Disclosure view.
 * Reachable at `/terms` and linked from the site footer + launch posts.
 */
const TermsRiskPage: React.FC = () => {
  const { locale } = useSiteLanguage();
  const termsDoc = useTermsRiskDocument();

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
            <Scale className="mt-1 h-5 w-5 shrink-0 text-cyan-300" />
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {termsDoc.title}
            </h1>
          </div>
          {termsDoc.intro ? (
            <p className="mt-5 text-sm leading-relaxed text-slate-300 sm:text-base whitespace-pre-line">
              {renderInlineMarkdown(termsDoc.intro)}
            </p>
          ) : null}
        </div>

        <div className="space-y-8">
          {termsDoc.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-base font-semibold text-white sm:text-lg">
                {section.heading}
              </h2>
              <div className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base whitespace-pre-line">
                {renderInlineMarkdown(section.body)}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
};

export default TermsRiskPage;
