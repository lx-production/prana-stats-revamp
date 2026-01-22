import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ChevronDown } from 'lucide-react';
import { usePranaPrices } from '../hooks/usePranaPrices';
import { usePranaConverter, type ConverterCurrency } from '../hooks/usePranaConverter';
import { formatDecimal, formatInteger } from '../utils/formatters';

const currencies: Array<{ value: ConverterCurrency; label: string }> = [
  { value: 'USD', label: 'USD' },
  { value: 'VND', label: 'VNĐ' },
  { value: 'SATs', label: 'SAT' },
];

export const PranaConverter: React.FC = () => {
  const { latestSatPrice, btcPriceUsd, usdToVndRate, isLoading, error } = usePranaPrices();

  const {
    currency,
    pranaInput,
    otherInput,
    isReady,
    preview,
    onPranaChange,
    onOtherChange,
    onCurrencyChange,
  } = usePranaConverter({
    latestSatPrice,
    btcPriceUsd,
    usdToVndRate,
  });
  const [isUnitOpen, setIsUnitOpen] = useState(false);
  const unitRef = useRef<HTMLDivElement | null>(null);
  const selectedCurrency = currencies.find((item) => item.value === currency) ?? currencies[0];

  useEffect(() => {
    if (!isUnitOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!unitRef.current) return;
      if (!unitRef.current.contains(event.target as Node)) {
        setIsUnitOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUnitOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUnitOpen]);

  useEffect(() => {
    if (!isReady) {
      setIsUnitOpen(false);
    }
  }, [isReady]);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 relative z-10">
      <div
        className="
          group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5
          backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:bg-white/10
        "
        style={{ animation: `fadeInUp 0.6s ease-out 0.15s backwards` }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
                Converter
              </div>
              <div className="text-xs text-gray-400">
                {isLoading ? (
                  'Loading live prices...'
                ) : error ? (
                  'Prices unavailable'
                ) : preview ? (
                  <>
                    1 PRANA ≈ {formatDecimal(preview.satsPerPrana, 2)} SAT ≈ {preview.usdPerPrana.toFixed(4)} USD ≈{' '}
                    {formatInteger(Math.round(preview.vndPerPrana))} VNĐ
                  </>
                ) : (
                  'Prices unavailable'
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Unit</span>
              <div className="relative" ref={unitRef}>
                <button
                  type="button"
                  className="
                    inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 pl-3 pr-3 py-2 text-sm font-medium text-gray-100
                    shadow-[0_0_0_1px_rgba(255,255,255,0.05),_0_10px_24px_rgba(0,0,0,0.35)]
                    outline-none transition hover:border-white/20 hover:bg-black/50
                    focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20
                    disabled:cursor-not-allowed disabled:opacity-50
                  "
                  onClick={() => setIsUnitOpen((prev) => !prev)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setIsUnitOpen(true);
                    }
                  }}
                  disabled={!isReady}
                  aria-haspopup="listbox"
                  aria-expanded={isUnitOpen}
                  aria-controls="unit-listbox"
                >
                  <span>{selectedCurrency.label}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition ${isUnitOpen ? 'rotate-180 text-cyan-300' : 'text-gray-400'}`}
                  />
                </button>
                {isUnitOpen ? (
                  <div
                    className="
                      absolute right-0 mt-2 w-32 rounded-xl border border-white/10 bg-[#0b0f14]/95 p-1
                      shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl
                    "
                  >
                    <ul id="unit-listbox" role="listbox" aria-label="Unit" className="space-y-1">
                      {currencies.map((c) => {
                        const isSelected = currency === c.value;
                        return (
                          <li key={c.value} role="option" aria-selected={isSelected}>
                            <button
                              type="button"
                              onClick={() => {
                                onCurrencyChange(c.value);
                                setIsUnitOpen(false);
                              }}
                              className={`
                                flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm
                                transition ${isSelected ? 'bg-white/10 text-cyan-200' : 'text-gray-200 hover:bg-white/5'}
                              `}
                            >
                              <span>{c.label}</span>
                              {isSelected ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-4 items-stretch">
            {/* PRANA input */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">PRANA</label>
              <input
                inputMode="decimal"
                placeholder="0"
                value={pranaInput}
                onChange={(e) => onPranaChange(e.target.value)}
                disabled={!isReady}
                className="
                  w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg text-white
                  outline-none placeholder:text-gray-600
                  focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20
                  disabled:opacity-50
                "
              />
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center">
              <div className="rounded-full border border-white/10 bg-white/5 p-3 text-gray-300">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
            </div>

            {/* Other input */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">{currency}</label>
              <input
                inputMode="decimal"
                placeholder="0"
                value={otherInput}
                onChange={(e) => onOtherChange(e.target.value)}
                disabled={!isReady}
                className="
                  w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg text-white
                  outline-none placeholder:text-gray-600
                  focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20
                  disabled:opacity-50
                "
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PranaConverter;
