import React from 'react';

import type { TokenIconMarkProps } from '../../types/tokenIcon.types';

/** Inline PRANA mark — avoids repeated /assets/icons/prana.svg network entries. */
const PranaIcon: React.FC<TokenIconMarkProps> = ({
  className = '',
  alt = '',
  decorative = false,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    className={className}
    role={decorative ? 'presentation' : 'img'}
    aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : alt}
  >
    <circle cx="16" cy="16" r="15.25" fill="#fff" />
    <path
      fill="#2a2f7d"
      d="M8.67,10a2.61,2.61,0,0,0,0,5.21h2.6V12.56A2.6,2.6,0,0,0,8.67,10Z"
    />
    <path
      fill="#2a2f7d"
      d="M22,8.67a2.61,2.61,0,0,0-5.21,0v2.6h2.61A2.6,2.6,0,0,0,22,8.67Z"
    />
    <path
      fill="#2a2f7d"
      d="M10,23.33a2.61,2.61,0,0,0,5.21,0v-2.6H12.56A2.6,2.6,0,0,0,10,23.33Z"
    />
    <path
      fill="#2a2f7d"
      d="M27.13,4.87a15.74,15.74,0,0,0-22.26,0,15.74,15.74,0,0,0,0,22.26,15.74,15.74,0,0,0,22.26,0,15.74,15.74,0,0,0,0-22.26ZM23.27,23.71a4.32,4.32,0,0,1-4.22-4.33v-1a1.57,1.57,0,0,0-1.56-1.57h-.65v6.44a4.28,4.28,0,1,1-4.22-4.22h1a1.57,1.57,0,0,0,1.57-1.56v-.65H8.73A4.28,4.28,0,1,1,13,12.62v1a1.57,1.57,0,0,0,1.56,1.57h.65V8.73A4.28,4.28,0,1,1,19.38,13h-1a1.57,1.57,0,0,0-1.57,1.56v.65h6.44a4.28,4.28,0,1,1,0,8.55Z"
    />
    <path
      fill="#2a2f7d"
      d="M23.33,16.83h-2.6v2.61a2.6,2.6,0,1,0,2.6-2.61Z"
    />
  </svg>
);

export default PranaIcon;
