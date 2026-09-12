import { BrandMark } from "./brand-mark";

export function AppFooter() {
  return (
    <footer className="shrink-0 border-t text-xs text-muted-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:min-h-12 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-4" />
          <p><span className="font-medium text-foreground">PulseCast</span><span className="mx-2 text-border" aria-hidden="true">/</span>Precision markets</p>
        </div>
        <nav aria-label="Project links" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a className="transition-colors duration-100 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href="https://www.magicblock.gg/" rel="noreferrer" target="_blank">Powered by MagicBlock ↗</a>
          <a className="transition-colors duration-100 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href="https://github.com/mitgajera/pulsecast" rel="noreferrer" target="_blank">GitHub ↗</a>
          <span className="font-mono text-chart-4">Devnet · Fees sponsored</span>
        </nav>
      </div>
    </footer>
  );
}
