/**
 * PLACEHOLDER logo mark for the PillNav logo bubble (26px square).
 * Replace with the organiser's own mark when supplied. The full name stays in the hero h1 and marquee.
 */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" role="img" aria-label="Beyond the Limits" data-placeholder="brand-mark">
      <rect width="26" height="26" rx="13" fill="#000" />
      <text x="13" y="19" textAnchor="middle" fontFamily="var(--font-anton), Impact, sans-serif" fontSize="17" fill="#DDBB4B">
        B
      </text>
    </svg>
  );
}
