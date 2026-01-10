import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatInteger } from '../utils/formatters';

export type ConverterCurrency = 'USD' | 'VND' | 'SATs';

type SourceField = 'prana' | 'other';

type UsePranaConverterArgs = {
  latestSatPrice: number | null;
  btcPriceUsd: number | null;
  usdToVndRate: number | null;
};

const parseNumberInput = (raw: string) => {
  const cleaned = raw.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

export function usePranaConverter({
  latestSatPrice,
  btcPriceUsd,
  usdToVndRate,
}: UsePranaConverterArgs) {
  const [currency, setCurrency] = useState<ConverterCurrency>('USD');
  const [pranaInput, setPranaInput] = useState<string>('');
  const [otherInput, setOtherInput] = useState<string>('');
  const [lastEdited, setLastEdited] = useState<SourceField>('prana');

  const isReady = Boolean(
    latestSatPrice && btcPriceUsd && usdToVndRate && latestSatPrice > 0 && btcPriceUsd > 0 && usdToVndRate > 0,
  );

  const formatOther = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return '';
      if (currency === 'SATs') return value.toFixed(2);
      if (currency === 'USD') return value.toFixed(5);
      return formatInteger(Math.round(value));
    },
    [currency],
  );

  const formatPrana = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return '';
      if (currency === 'SATs') return value.toFixed(2);
      if (currency === 'USD') return value.toFixed(5);
      return formatInteger(Math.round(value));
    },
    [currency],
  );

  const clearIfBothEmpty = useCallback((nextPranaRaw: string, nextOtherRaw: string) => {
    if (!nextPranaRaw && !nextOtherRaw) {
      setPranaInput('');
      setOtherInput('');
      return true;
    }
    return false;
  }, []);

  const convertFromPrana = useCallback(
    (prana: number) => {
      if (!isReady || !latestSatPrice || !btcPriceUsd || !usdToVndRate) return '';
      if (currency === 'SATs') return formatOther(prana * latestSatPrice);
      if (currency === 'USD') return formatOther((prana * latestSatPrice / 1e8) * btcPriceUsd);
      return formatOther((prana * latestSatPrice / 1e8) * btcPriceUsd * usdToVndRate);
    },
    [btcPriceUsd, currency, formatOther, isReady, latestSatPrice, usdToVndRate],
  );

  const convertFromOther = useCallback(
    (other: number) => {
      if (!isReady || !latestSatPrice || !btcPriceUsd || !usdToVndRate) return '';
      if (currency === 'SATs') return formatPrana(other / latestSatPrice);
      if (currency === 'USD') return formatPrana(other / ((latestSatPrice / 1e8) * btcPriceUsd));
      return formatPrana(other / ((latestSatPrice / 1e8) * btcPriceUsd * usdToVndRate));
    },
    [btcPriceUsd, currency, formatPrana, isReady, latestSatPrice, usdToVndRate],
  );

  const onPranaChange = useCallback(
    (nextRaw: string) => {
      if (clearIfBothEmpty(nextRaw, otherInput)) return;
      setLastEdited('prana');
      setPranaInput(nextRaw);
      setOtherInput(convertFromPrana(parseNumberInput(nextRaw)));
    },
    [clearIfBothEmpty, convertFromPrana, otherInput],
  );

  const onOtherChange = useCallback(
    (nextRaw: string) => {
      if (clearIfBothEmpty(pranaInput, nextRaw)) return;
      setLastEdited('other');
      setOtherInput(nextRaw);
      setPranaInput(convertFromOther(parseNumberInput(nextRaw)));
    },
    [clearIfBothEmpty, convertFromOther, pranaInput],
  );

  const onCurrencyChange = useCallback(
    (nextCurrency: ConverterCurrency) => {
      setCurrency(nextCurrency);
    },
    [],
  );

  // When currency changes, recompute the "derived" side from the last edited input.
  useEffect(() => {
    if (!isReady) return;
    if (!pranaInput && !otherInput) return;

    if (lastEdited === 'prana') {
      setOtherInput(convertFromPrana(parseNumberInput(pranaInput)));
    } else {
      setPranaInput(convertFromOther(parseNumberInput(otherInput)));
    }
  }, [convertFromOther, convertFromPrana, currency, isReady, lastEdited, otherInput, pranaInput]);

  const preview = useMemo(() => {
    if (!isReady || !latestSatPrice || !btcPriceUsd || !usdToVndRate) return null;
    const pranaUsd = (latestSatPrice / 1e8) * btcPriceUsd;
    const pranaVnd = pranaUsd * usdToVndRate;
    return {
      satsPerPrana: latestSatPrice,
      usdPerPrana: pranaUsd,
      vndPerPrana: pranaVnd,
    };
  }, [btcPriceUsd, isReady, latestSatPrice, usdToVndRate]);

  return {
    currency,
    pranaInput,
    otherInput,
    isReady,
    preview,
    onPranaChange,
    onOtherChange,
    onCurrencyChange,
  };
}

