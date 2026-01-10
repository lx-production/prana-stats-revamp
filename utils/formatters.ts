// Helper functions for formatting values in the UI

export const formatCurrency = (value: number | null, currency: 'VND' | 'PRANA') => {
  if (value === null || value === undefined) return 'Loading...';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: currency === 'PRANA' ? 0 : 0,
    maximumFractionDigits: currency === 'PRANA' ? 0 : 0,
  });
};

export const formatPercent = (value: number) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
};

export const formatInteger = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};