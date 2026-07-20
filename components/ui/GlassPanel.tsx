import React from 'react';

import type { GlassPanelProps } from '../../types/glassPanel.types';

/**
 * Frosted glass panel matching StatCard language
 * (rounded-2xl, white/10 border, white/5 fill, backdrop blur).
 */
export default function GlassPanel({
  children,
  className = '',
  as: Tag = 'section',
  hoverable = false,
}: GlassPanelProps) {
  return (
    <Tag
      className={`
        rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md
        ${
          hoverable
            ? 'transition-all duration-500 hover:border-white/20 hover:bg-white/10 focus-within:border-white/20 focus-within:bg-white/10'
            : ''
        }
        ${className}
      `}
    >
      {children}
    </Tag>
  );
}
