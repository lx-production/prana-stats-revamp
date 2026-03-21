import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useManifestoItems } from "../hooks/useManifestoItems";

type ManifestoProps = {
  isOpen: boolean;
  onClose: () => void;
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1 },
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

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manifesto-title"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.25 }}
        >
          <motion.button
            type="button"
            onClick={onClose}
            aria-label="Close manifesto popup"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.25 }}
          />
          <motion.div
            className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#070b1f]/70 p-5 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
            variants={dialogVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.35, delay: 0.05 }}
          >
            <div className="relative mb-5">
              <h2
                id="manifesto-title"
                className="px-12 text-center text-xl font-semibold text-white"
              >
                10 GIAO ƯỚC PRANA
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-lg border border-white/15 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 text-center">
              {items.map((item) => (
                <div key={item.id}>
                  <h3 className="text-base font-medium text-white">
                    {item.id}. {item.question}
                  </h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Manifesto;
