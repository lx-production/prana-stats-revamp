export function formatPranaBalance(balance: string) {
  const value = Number(balance);
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

