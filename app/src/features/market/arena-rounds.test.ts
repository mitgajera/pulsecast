import { describe, expect, it } from "vitest";
import type { PublicRound } from "@pulsecast/shared";

import { selectArenaRounds, toArenaRound } from "./arena-rounds";

const round = (id: number, openAt: number, status: PublicRound["status"] = "scheduled"): PublicRound => ({
  account: "1ZRvJzwWBV2hbcQkiCbsoZRUcE6AgXC7UXqM36zFzER",
  actualPrice: "0", actualPublishTime: 0, entryAmount: "1000000", feeBps: 100,
  id: String(id), lockAt: openAt + 30, maxErrorBps: 250, openAt, predictionCount: 2,
  resolveAt: openAt + 60, schemaVersion: "current", startPrice: "7700000000000",
  startPublishTime: openAt, status, totalPool: "2000000",
});

describe("arena round selection", () => {
  it("selects previous, current, and next by timestamps", () => {
    const selected = selectArenaRounds([round(3, 180), round(1, 60), round(2, 120)], 135);
    expect(selected.previous?.id).toBe("1");
    expect(selected.current?.id).toBe("2");
    expect(selected.next?.id).toBe("3");
  });

  it("does not treat stale onchain status as a live market", () => {
    const selected = selectArenaRounds([round(1, 60, "watching")], 300);
    expect(selected.current).toBeNull();
    expect(selected.previous?.id).toBe("1");
  });

  it("maps atomic values and derives the effective phase", () => {
    expect(toArenaRound(round(2, 120), "Live", 140)).toMatchObject({ phase: "betting", openingPrice: 77_000, poolUsdc: 2 });
  });
});
