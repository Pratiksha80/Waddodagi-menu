import React from 'react';

export const GoldFlourish: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 180 18"
    fill="none"
    className={`text-gold ${className}`}
    aria-hidden
  >
    <path
      d="M4 9h62M114 9h62"
      stroke="currentColor"
      strokeWidth="1"
      opacity="0.7"
    />
    <path
      d="M90 2.5c4 3.2 8.2 6.5 8.2 6.5S94 12.3 90 15.5C86 12.3 81.8 9 81.8 9S86 5.7 90 2.5Z"
      stroke="currentColor"
      strokeWidth="1.1"
      fill="none"
    />
    <circle cx="90" cy="9" r="1.6" fill="currentColor" />
  </svg>
);
