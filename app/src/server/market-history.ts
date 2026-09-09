import "server-only";

import { marketHistorySchema, type MarketHistory } from "@pulsecast/shared";

import { createOracleHistory } from "@/features/market/oracle-sample";

export function getMarketHistory(roundOpenAt: number, serverTimeMs = Date.now()): MarketHistory {
  return marketHistorySchema.parse({
    roundId: String(roundOpenAt),
    samples: createOracleHistory(roundOpenAt, serverTimeMs),
    serverTimeMs,
    source: "fixture",
  });
}
