import { SECONDS_PER_DAY } from '../../constants/network.ts';

import type { SiteLocale } from '../../types/locale.types.ts';

const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;

/**
 * Formats grace-window remaining time as "6 ngày 14 giờ 22 phút" (VI)
 * or "6 days 14 hours 22 minutes" (EN). Floors to whole minutes.
 */
export function formatGraceRemainingLabel(
  remainingSeconds: number,
  locale: SiteLocale,
): string {
  const total = Math.max(0, Math.floor(remainingSeconds));
  const days = Math.floor(total / SECONDS_PER_DAY);
  const hours = Math.floor((total % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  if (locale === 'en') {
    return `${days} days ${hours} hours ${minutes} minutes`;
  }

  return `${days} ngày ${hours} giờ ${minutes} phút`;
}
