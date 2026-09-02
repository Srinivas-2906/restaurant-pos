/** Brand marks for aggregator mockup UI — simplified SVG representations */

export function SwiggyLogo({ className = "h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 32" className={className} aria-label="Swiggy">
      <rect width="120" height="32" rx="6" fill="#FF5200" />
      <text
        x="60"
        y="21"
        textAnchor="middle"
        fill="white"
        fontSize="14"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        SWIGGY
      </text>
    </svg>
  );
}

export function ZomatoLogo({ className = "h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 32" className={className} aria-label="Zomato">
      <rect width="120" height="32" rx="6" fill="#E23744" />
      <text
        x="60"
        y="21"
        textAnchor="middle"
        fill="white"
        fontSize="14"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        ZOMATO
      </text>
    </svg>
  );
}
