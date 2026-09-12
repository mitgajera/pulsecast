import type { MarketHistory } from "@pulsecast/shared";

import { ForecastTicket } from "./forecast-ticket";
import type { MarketRound } from "./fixtures";
import { MarketClock } from "./market-clock";
import { PriceChartShell } from "./price-chart-shell";
import { RoundRail } from "./round-rail";

const usdc = new Intl.NumberFormat("en-US", { currency: "USD", style: "currency", minimumFractionDigits: 2 });

export function LiveArena({ history, initialServerTimeMs, rounds }: { history: MarketHistory; initialServerTimeMs: number; rounds: MarketRound[] }) {
  const current = rounds.find((round) => round.label === "Live");
  if (!current) return null;
  const watching = current.phase !== "betting";

  return (
    <div className="space-y-4">
      <RoundRail rounds={rounds} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="overflow-hidden border bg-card" id={`round-${current.id}`}>
          <section className="border-b px-4 py-5 sm:px-6" aria-labelledby="market-heading">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">BTC / USD · Round {current.id}</p>
                <h1 className="mt-2 max-w-xl text-xl font-semibold tracking-tight sm:text-2xl" id="market-heading">Predict the minute-close price</h1>
              </div>
              <MarketClock initialServerTimeMs={initialServerTimeMs} lockAt={current.lockAt} resolveAt={current.resolveAt} />
            </div>
          </section>
          <PriceChartShell
            initialSamples={history.samples}
            openAt={current.openAt}
            resolveAt={current.resolveAt}
            source={history.source}
          />
          <section className="grid border-t bg-card sm:grid-cols-3" aria-label="Round statistics">
            <Stat label="Pool" value={`${usdc.format(current.poolUsdc)} USDC`} />
            <Stat label="Predictions" value={String(current.predictions)} />
            <Stat label="Opening price" value={`$${current.openingPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
          </section>
        </main>
        <aside className="space-y-4 lg:sticky lg:top-20">
          <ForecastTicket roundId={current.id} stakeUsdc={current.entryAmountUsdc} watching={watching} />
          <section className="border bg-card p-5" aria-labelledby="precision-title">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">How rewards work</p>
            <h2 className="mt-1 font-semibold" id="precision-title">Precision beats direction</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Predict the exact closing price. The nearer your forecast, the larger your share of the eligible pool.</p>
            <dl className="mt-4 space-y-3 border-t pt-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Protocol fee</dt><dd className="font-mono tabular-nums">1.00%</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Network</dt><dd>Solana Devnet</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Execution</dt><dd>MagicBlock ER</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border-b px-4 py-3.5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 truncate font-mono text-sm font-medium tabular-nums">{value}</p></div>;
}
