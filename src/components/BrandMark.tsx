import React from 'react';

interface BrandMarkProps {
  className?: string;
  size?: number;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ className = '', size = 34 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Automator AI Brand Mark"
    >
      <defs>
        <linearGradient id="automatorCoreGrad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent-primary)" />
          <stop offset="100%" stopColor="var(--accent-secondary)" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="10"
        fill="url(#automatorCoreGrad)"
        fillOpacity="0.14"
        stroke="url(#automatorCoreGrad)"
        strokeWidth="1.75"
      />
      <path
        d="M20 8L30 28H24.6L20 18.2L15.4 28H10L20 8Z"
        fill="url(#automatorCoreGrad)"
      />
      <circle cx="20" cy="26.5" r="2.2" fill="var(--accent-secondary)" />
    </svg>
  );
};
