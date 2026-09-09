import type { MarketRound } from "./fixtures";

const price = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
  maximumFractionDigits: 2,
});

const time = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function RoundRail({ rounds }: { rounds: MarketRound[] }) {
  return (
    <nav className="grid grid-cols-3 border-x border-t bg-card" aria-label="Market rounds">
      {rounds.map((round) => {
        const active = round.label === "Live";
        return (
          <a
            className={`min-w-0 border-b px-3 py-3 transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:px-4 ${
              active
                ? "border-b-primary bg-accent"
                : "border-r last:border-r-0 hover:bg-muted"
            }`}
            href={`#round-${round.id}`}
            key={round.id}
          >
            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {active && <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />}
              {round.label}
            </span>
            <span className="mt-1 block truncate font-mono text-sm font-medium tabular-nums sm:text-base">
              {time.format(new Date(round.resolveAt * 1_000))}
            </span>
            <span className="mt-1 hidden text-xs text-muted-foreground sm:block">
              {round.closingPrice ? price.format(round.closingPrice) : `${round.predictions} predictions`}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
