import type { ReactNode } from 'react';

/** Visual tone for shared status / alert banners. */
export type StatusBannerTone = 'neutral' | 'success' | 'warning' | 'error';

export type StatusBannerProps = {
  children: ReactNode;
  tone?: StatusBannerTone;
  className?: string;
  /**
   * Override live region. Defaults: error → assertive, others → polite.
   * Pass `"off"` for static hints that should not announce.
   */
  live?: 'polite' | 'assertive' | 'off';
};
