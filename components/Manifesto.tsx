import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useManifestoItems } from "../hooks/useManifestoItems";

type ManifestoProps = {
  isOpen: boolean;
  onClose: () => void;
};

const Manifesto: React.FC<ManifestoProps> = ({ isOpen, onClose }) => {
  const items = useManifestoItems();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manifesto-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close manifesto popup"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#070b1f]/70 p-5 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.6)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="manifesto-title" className="text-xl font-semibold text-white">
            PRANA Manifesto
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-white/10 bg-[#0b0c27]/70 p-4"
            >
              <h3 className="text-base font-medium text-white">{item.question}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Manifesto;
