import { describe, expect, it } from "vitest";

import { publicRoundSchema, roundIndexSchema } from "./round";

const round = {
  account: "1ZRvJzwWBV2hbcQkiCbsoZRUcE6AgXC7UXqM36zFzER",
  actualPrice: "0",
  actualPublishTime: 0,
  entryAmount: "1000000",
  feeBps: 100,
  id: "1",
  lockAt: 150,
  maxErrorBps: 250,
  openAt: 120,
  predictionCount: 0,
  resolveAt: 180,
  schemaVersion: "current" as const,
  startPrice: "0",
  startPublishTime: 0,
  status: "scheduled" as const,
  totalPool: "0",
};

describe("public round contracts", () => {
  it("preserves integer amounts as strings", () => {
    expect(publicRoundSchema.parse(round)).toEqual(round);
    expect(roundIndexSchema.parse({ rounds: [round], serverTimeMs: 1, source: "solana-devnet" }).rounds).toHaveLength(1);
  });

  it("rejects unsafe fee and numeric amount representations", () => {
    expect(() => publicRoundSchema.parse({ ...round, feeBps: 10_001 })).toThrow();
    expect(() => publicRoundSchema.parse({ ...round, totalPool: 1 })).toThrow();
  });
});
