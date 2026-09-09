import { describe, expect, it } from "vitest";

import { marketHistorySchema, oracleSampleSchema } from "./oracle";

describe("oracle transport schemas", () => {
  it("accepts a valid normalized sample", () => {
    expect(oracleSampleSchema.parse({ price: 112_900.12, sourceTimestampMs: 1_800_000_000_000, slot: 410_000_001 })).toEqual({
      price: 112_900.12,
      sourceTimestampMs: 1_800_000_000_000,
      slot: 410_000_001,
    });
  });

  it("rejects invalid prices and oversized payloads", () => {
    expect(() => oracleSampleSchema.parse({ price: -1, sourceTimestampMs: 1, slot: 1 })).toThrow();
    const sample = { price: 1, sourceTimestampMs: 1, slot: 1 };
    expect(() => marketHistorySchema.parse({ roundId: "1", samples: Array.from({ length: 1_201 }, () => sample), serverTimeMs: 1, source: "fixture" })).toThrow();
  });
});
