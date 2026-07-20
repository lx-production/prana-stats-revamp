import type { ElementType, ReactNode } from 'react';

export type GlassPanelProps = {
  children: ReactNode;
  className?: string;
  /** Semantic wrapper — default `section`. */
  as?: ElementType;
  /** Match StatCard hover border/background lift. */
  hoverable?: boolean;
};
