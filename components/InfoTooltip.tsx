import React from 'react';
import { Info } from 'lucide-react';

type InfoTooltipProps = {
  text: string;
  ariaLabel: string;
  title?: string;
  widthClassName?: string;
  positionClassName?: string;
};

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, ariaLabel, title, widthClassName, positionClassName }) => (
  <details className="font-sans shrink-0">
    <summary
      className="cursor-pointer inline-flex items-center [&::-webkit-details-marker]:hidden"
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
    >
      <Info className="w-4 h-4 text-cyan-400/80 hover:text-cyan-300 transition-colors" />
    </summary>
    <div
      className={[
        "absolute z-50 rounded-xl border border-white/10 bg-black/80 backdrop-blur-md",
        positionClassName ?? "top-full mt-2 left-0",
        widthClassName ?? "w-[min(20rem,calc(100vw-2rem))]",
        "p-3 text-sm tracking-normal text-gray-200 normal-case shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
      ].join(' ')}
    >
      <div className="leading-relaxed">{text}</div>
    </div>
  </details>
);

export default InfoTooltip;
