import { AuthControl } from "@/features/auth/auth-control";
import { selectArenaRounds, toArenaRound } from "@/features/market/arena-rounds";
import { LiveArena } from "@/features/market/live-arena";
import { NoLiveMarket } from "@/features/market/no-live-market";
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
      <header className="border-b bg-background/95">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a className="flex min-h-11 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" href="#market">
            <span className="flex h-6 items-end gap-0.5" aria-hidden="true"><span className="h-2 w-1 bg-primary" /><span className="h-5 w-1 bg-primary" /><span className="h-3 w-1 bg-primary" /><span className="h-6 w-1 bg-primary" /></span>
            <span className="text-base font-semibold tracking-tight">PulseCast</span>
          </a>
          <div className="flex items-center gap-3"><span className="hidden text-xs text-muted-foreground sm:inline">Solana Devnet</span><AuthControl /></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8" id="market">
        {selection.current ? (
          <LiveArena history={await getMarketHistory(selection.current.openAt, initialServerTimeMs)} initialServerTimeMs={initialServerTimeMs} rounds={arenaRounds} />
        ) : (
          <NoLiveMarket rounds={index.rounds} />
        )}
      </div>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-t px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8"><p>PulseCast · Minute-precision markets</p><p>Preview data · Devnet only</p></footer>
    </div>
  );
}
