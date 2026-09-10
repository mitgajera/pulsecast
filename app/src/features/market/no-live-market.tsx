import type { PublicRound } from "@pulsecast/shared";
import Link from "next/link";

const timestamp = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

export function NoLiveMarket({ rounds }: { rounds: PublicRound[] }) {
  const recent = [...rounds].sort((left, right) => right.openAt - left.openAt).slice(0, 3);

  return (
    <main className="border bg-card" aria-labelledby="empty-market-title">
      <section className="border-b px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Market schedule</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl" id="empty-market-title">No market is open</h1>
        <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
          The operator controls when minute markets run. The MagicBlock BTC feed can remain online while betting stays closed.
        </p>
        <Link className="mt-6 inline-flex min-h-11 items-center border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href="/">Check again</Link>
      </section>
      <section aria-labelledby="recent-rounds-title">
        <div className="border-b px-5 py-4 sm:px-8">
          <h2 className="font-semibold" id="recent-rounds-title">Recent devnet rounds</h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground sm:px-8">No rounds have been created yet.</p>
        ) : (
          <div className="divide-y">
            {recent.map((round) => (
              <div className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:px-8" key={round.account}>
                <div><p className="font-medium">Round {round.id}</p><p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{timestamp.format(new Date(round.openAt * 1_000))}</p></div>
                <div><p className="capitalize">{round.status}</p><p className="mt-1 text-xs text-muted-foreground">{round.schemaVersion === "current" ? "Current schema" : "Legacy devnet schema"}</p></div>
                <a className="inline-flex min-h-10 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href={`https://explorer.solana.com/address/${round.account}?cluster=devnet`} rel="noreferrer" target="_blank">View account</a>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
