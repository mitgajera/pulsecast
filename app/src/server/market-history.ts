import "server-only";

import { marketHistorySchema, type MarketHistory } from "@pulsecast/shared";

export async function getMarketHistory(roundOpenAt: number, serverTimeMs = Date.now()): Promise<MarketHistory> {
  const collectorUrl = process.env.ORACLE_COLLECTOR_URL;
  if (collectorUrl) {
    try {
      const response = await fetch(`${collectorUrl}/v1/history?roundId=${roundOpenAt}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(1_500),
      });
      if (response.ok) return marketHistorySchema.parse(await response.json());
    } catch {
      // A missing oracle must never be presented as a live market price.
    }
  }

  return marketHistorySchema.parse({
    roundId: String(roundOpenAt),
    samples: [],
    serverTimeMs,
    source: "fixture",
  });
}
