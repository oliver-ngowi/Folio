import * as React from "react";

/**
 * Folio mark: a geometric "F" whose top bar ends in a folded page corner,
 * set on a black tile.
 */
export function Logo({ className }: { className?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Folio"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="6" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2b2b2b" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}-bg)`} />
      <rect width="64" height="64" rx="16" fill={`url(#${id}-shine)`} />
      <g fill="#fff">
        <path d="M23 14H42L48 20V21A3 3 0 0 1 45 24H20V17A3 3 0 0 1 23 14Z" />
        <path d="M20 20H30V47A3 3 0 0 1 27 50H23A3 3 0 0 1 20 47Z" />
        <path d="M30 28H37A3 3 0 0 1 40 31V33A3 3 0 0 1 37 36H30Z" />
      </g>
      <path d="M42 14L48 20H42Z" fill="#000" fillOpacity="0.28" />
    </svg>
  );
}
