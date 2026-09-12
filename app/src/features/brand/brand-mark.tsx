export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`${className} shrink-0 text-primary`} fill="none" viewBox="0 0 36 36">
      <circle cx="18" cy="18" fill="currentColor" r="17" />
      <g fill="var(--primary-foreground)" transform="rotate(20 18 18)">
        <circle cx="6.75" cy="18" r="2.15" />
        <rect height="14" rx="2.35" width="4.7" x="10.25" y="11" />
        <rect height="24" rx="2.35" width="4.7" x="15.65" y="6" />
        <rect height="14" rx="2.35" width="4.7" x="21.05" y="11" />
        <circle cx="29.25" cy="18" r="2.15" />
      </g>
    </svg>
  );
}
