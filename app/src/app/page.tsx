import { AppHeader } from "@/features/brand/app-header";
import { AppFooter } from "@/features/brand/app-footer";
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
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <AppHeader active="market" />
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4 lg:px-8" id="market">
        {selection.current ? (
          <LiveArena history={await getMarketHistory(selection.current.openAt, initialServerTimeMs)} initialServerTimeMs={initialServerTimeMs} rounds={arenaRounds} />
        ) : (
          <><MarketAutoRefresh resolveAt={selection.next?.openAt ?? null} /><NoLiveMarket nowMs={initialServerTimeMs} rounds={index.rounds} /></>
        )}
      </div>
      <AppFooter />
    </div>
  );
}
