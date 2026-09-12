import { AppHeader } from "@/features/brand/app-header";
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
      <AppHeader active="market" />
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
