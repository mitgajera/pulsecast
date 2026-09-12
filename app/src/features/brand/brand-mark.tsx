export function BrandMark({ className = "size-8" }: { className?: string }) {
  return <svg aria-hidden="true" className={`${className} shrink-0 text-primary`} fill="none" viewBox="0 0 32 32"><rect height="31" stroke="currentColor" strokeOpacity="0.38" width="31" x="0.5" y="0.5" /><path d="M5 18h5l2.5-7 4 13 3.5-9 2 3h5" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" /><path d="M24 6v20" stroke="currentColor" strokeDasharray="2 3" strokeOpacity="0.45" /><rect fill="currentColor" height="4" width="4" x="22" y="16" /></svg>;
}
