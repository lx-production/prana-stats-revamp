import React, { useState } from "react";
import { ChevronDown, MessageCircleQuestion } from "lucide-react";
import { useFaqItems } from "../hooks/useFaqItems";
import { useSiteLanguage } from "../hooks/useSiteLanguage";

const FaqSection: React.FC = () => {
  const { locale } = useSiteLanguage();
  const faqItems = useFaqItems();
  const [openItemId, setOpenItemId] = useState<string>("");

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <MessageCircleQuestion className="h-4 w-4 text-cyan-300" />
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            {locale === "en"
              ? "Frequently Asked Questions"
              : "Câu Hỏi Thường Gặp"}
          </h2>
        </div>

        <div className="space-y-3">
          {faqItems.map((item) => {
            const isOpen = openItemId === item.id;
            return (
              <article
                key={item.id}
                className="rounded-xl border border-white/10 bg-[#0b0c27]/70 transition-colors duration-200 hover:border-white/20"
              >
                <button
                  type="button"
                  onClick={() => setOpenItemId(isOpen ? "" : item.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${item.id}`}
                  className="w-full flex items-center justify-between gap-3 text-left px-4 py-4"
                >
                  <span className="text-sm sm:text-base font-medium text-white">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-cyan-200 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  id={`faq-answer-${item.id}`}
                  className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="min-h-0">
                    <div className="px-4 pb-4 text-sm sm:text-base leading-relaxed text-slate-300 whitespace-pre-line">
                      {item.answer}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
