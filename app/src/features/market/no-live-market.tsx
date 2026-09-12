import type { PublicRound } from "@pulsecast/shared";

import { RefreshMarketsButton } from "./refresh-markets-button";

const timestamp = new Intl.DateTimeFormat("en-US", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" });
const clock = new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, minute: "2-digit", second: "2-digit" });
const usdc = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function NoLiveMarket({ nowMs, rounds }: { nowMs: number; rounds: PublicRound[] }) {
  const nowSeconds = Math.floor(nowMs / 1_000);
  const next = [...rounds].filter((round) => round.openAt > nowSeconds && round.status !== "cancelled").sort((left, right) => left.openAt - right.openAt)[0];
  const recent = [...rounds].filter((round) => round.resolveAt <= nowSeconds).sort((left, right) => right.openAt - left.openAt).slice(0, 3);

  return (
    <main className="overflow-hidden border bg-card" aria-labelledby="empty-market-title">
      <section className="grid gap-5 border-b px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"><span className="size-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />Between rounds</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight" id="empty-market-title">The next minute market is being prepared</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">The BTC oracle remains online. PulseCast moves into the next betting window automatically when a round opens.</p>
          <div className="mt-4"><RefreshMarketsButton /></div>
        </div>
        <div className="border bg-background/50 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Next round</p>
          {next ? <><p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{clock.format(new Date(next.openAt * 1_000))}</p><p className="mt-2 text-sm text-muted-foreground">Round {next.id} opens automatically</p></> : <><p className="mt-2 text-lg font-semibold">Awaiting schedule</p><p className="mt-2 text-sm leading-6 text-muted-foreground">The operator controls when devnet markets run.</p></>}
        </div>
      </section>

      <section className="grid border-b sm:grid-cols-3" aria-label="Market cadence">
        <Cadence label="Predict" time="01–30" description="Enter an exact BTC close price" />
        <Cadence label="Watch" time="31–60" description="Predictions remain locked" />
        <Cadence label="Resolve" time=":60" description="Oracle sets the closing price" />
      </section>

      <section aria-labelledby="recent-rounds-title">
        <div className="border-b px-5 py-3 sm:px-6"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Onchain history</p><h2 className="mt-1 font-semibold" id="recent-rounds-title">Recent rounds</h2></div>
        {recent.length === 0 ? (
          <div className="px-5 py-8 sm:px-8"><p className="font-medium">No completed rounds yet</p><p className="mt-2 text-sm text-muted-foreground">Resolved markets will appear here with their pool and closing price.</p></div>
        ) : (
          <div className="divide-y">
            {recent.map((round) => <RoundRow key={round.account} round={round} />)}
          </div>
        )}
      </section>
    </main>
  );
}

function Cadence({ description, label, time }: { description: string; label: string; time: string }) {
  return <div className="border-b px-5 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:px-6"><div className="flex items-baseline justify-between gap-4"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="font-mono text-sm font-semibold tabular-nums">{time}</p></div><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

function RoundRow({ round }: { round: PublicRound }) {
  const pool = Number(BigInt(round.totalPool)) / 1_000_000;
  const resolved = round.actualPrice !== "0";
  const close = resolved ? Number(BigInt(round.actualPrice)) / 100_000_000 : null;
  const status = round.status === "cancelled" ? "Cancelled" : round.status === "settled" ? "Settled" : "Awaiting settlement";

  return (
    <article className="grid gap-3 px-5 py-3 text-sm sm:grid-cols-[0.8fr_1.2fr_auto] sm:items-center sm:px-6">
      <div><p className="font-medium">Round {round.id}</p><p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{timestamp.format(new Date(round.openAt * 1_000))}</p></div>
      <div className="grid grid-cols-2 gap-4"><div><p className="text-xs text-muted-foreground">Result</p><p className="mt-1 font-mono tabular-nums">{close === null ? status : `$${close.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}</p></div><div><p className="text-xs text-muted-foreground">Pool</p><p className="mt-1 font-mono tabular-nums">{usdc.format(pool)} USDC</p></div></div>
      <a className="inline-flex min-h-10 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href={`https://explorer.solana.com/address/${round.account}?cluster=devnet`} rel="noreferrer" target="_blank">View proof ↗</a>
    </article>
  );
}
