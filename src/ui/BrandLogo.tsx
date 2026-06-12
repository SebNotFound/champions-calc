/**
 * The Champions Calc mark — a Pokéball on a screen. Just the symbol (no
 * wordmark); colour/size come from the CSS class (accent in the header, muted
 * in the footer).
 */
export function BrandLogo({ className = 'brand-logo' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 52 36" aria-hidden="true">
      <rect x="2" y="6" width="48" height="24" rx="7" />
      <line x1="2" y1="18" x2="19" y2="18" />
      <line x1="33" y1="18" x2="50" y2="18" />
      <circle cx="26" cy="18" r="7" />
      <circle className="brand-logo-dot" cx="26" cy="18" r="2.2" />
    </svg>
  );
}
