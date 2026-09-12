import { AuthControl } from "@/features/auth/auth-control";
import { selectArenaRounds, toArenaRound } from "@/features/market/arena-rounds";
import { LiveArena } from "@/features/market/live-arena";
import { NoLiveMarket } from "@/features/market/no-live-market";
import { MarketAutoRefresh } from "@/features/market/market-auto-refresh";
import { getMarketHistory } from "@/server/market-history";
import { fetchRoundIndex } from "@/server/round-index";

export const dynamic = "force-dynamic";

export default async function Home() {
  // A live round is intentionally anchored to request time on the server.
  // eslint-disable-next-line react-hooks/purity
  const initialServerTimeMs = Date.now();
  const index = await fetchRoundIndex(initialServerTimeMs);
  const selection = selectArenaRounds(index.rounds, Math.floor(initialServerTimeMs / 1_000));
  const arenaRounds = [
    selection.previous && toArenaRound(selection.previous, "Previous", Math.floor(initialServerTimeMs / 1_000)),
    selection.current && toArenaRound(selection.current, "Live", Math.floor(initialServerTimeMs / 1_000)),
    selection.next && toArenaRound(selection.next, "Next", Math.floor(initialServerTimeMs / 1_000)),
  ].filter((round) => round !== null);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a className="flex min-h-11 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" href="#market">
            <span className="grid size-8 grid-cols-4 items-end gap-0.5 border bg-card p-1.5" aria-hidden="true"><span className="h-2 bg-primary" /><span className="h-4 bg-primary" /><span className="h-3 bg-primary" /><span className="h-5 bg-primary" /></span>
            <span><span className="block text-sm font-semibold tracking-tight">PulseCast</span><span className="hidden text-[11px] text-muted-foreground sm:block">Precision markets</span></span>
          </a>
          <div className="flex items-center gap-2 sm:gap-3"><span className="hidden min-h-8 items-center border px-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-chart-4 sm:flex"><span className="mr-2 size-1.5 rounded-full bg-chart-4" aria-hidden="true" />Devnet</span><AuthControl /></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8" id="market">
        {selection.current ? (
          <LiveArena history={await getMarketHistory(selection.current.openAt, initialServerTimeMs)} initialServerTimeMs={initialServerTimeMs} rounds={arenaRounds} />
        ) : (
          <><MarketAutoRefresh resolveAt={selection.next?.openAt ?? null} /><NoLiveMarket rounds={index.rounds} /></>
        )}
      </div>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-t px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8"><p>PulseCast · Minute-close precision markets</p><p>Devnet USDC · Fees sponsored</p></footer>
    </div>
  );
}
