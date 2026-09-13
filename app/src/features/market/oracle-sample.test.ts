import { describe, expect, it } from "vitest";

import { createOracleHistory, mergeOracleHistory, mergeOracleSamples, nextFixtureSample, toChartPoints } from "./oracle-sample";

describe("oracle sample fixtures", () => {
  it("creates ordered half-second history without gaps", () => {
    const history = createOracleHistory(1_800_000_000);
    expect(history).toHaveLength(181);
    expect(history[1]!.sourceTimestampMs - history[0]!.sourceTimestampMs).toBe(500);
    expect(history.at(-1)!.sourceTimestampMs).toBe(1_800_000_000_000);
  });

  it("ignores duplicate and out-of-order samples", () => {
    const history = createOracleHistory(1_800_000_000);
    const latest = history.at(-1)!;
    expect(mergeOracleSamples(history, latest)).toBe(history);
    expect(mergeOracleSamples(history, { ...latest, sourceTimestampMs: latest.sourceTimestampMs - 1 })).toBe(history);
  });

  it("adds a newer bounded sample", () => {
    const history = createOracleHistory(1_800_000_000);
    const latest = history.at(-1)!;
    const next = nextFixtureSample(latest, latest.sourceTimestampMs + 200, 1_800_000_000);
    const merged = mergeOracleSamples(history, next);
    expect(merged).toHaveLength(182);
    expect(merged.at(-1)).toEqual(next);
  });

  it("reconciles overlapping history without duplicates", () => {
    const history = createOracleHistory(1_800_000_000);
    const latest = history.at(-1)!;
    const newer = nextFixtureSample(latest, latest.sourceTimestampMs + 500, 1_800_000_000);
    const merged = mergeOracleHistory(history, [history.at(-2)!, latest, newer]);
    expect(merged).toHaveLength(history.length + 1);
    expect(merged.at(-1)).toEqual(newer);
  });

  it("orders second-granular updates by slot", () => {
    const current = [{ price: 77_100, sourceTimestampMs: 1_800_000_000_000, slot: 10 }];
    const newerSlot = { price: 77_101, sourceTimestampMs: 1_800_000_000_000, slot: 11 };
    expect(mergeOracleSamples(current, newerSlot)).toEqual([...current, newerSlot]);
    expect(mergeOracleSamples(current, { ...newerSlot, slot: 9 })).toBe(current);
  });

  it("preserves sub-second chart samples", () => {
    const samples = [
      { price: 77_100, sourceTimestampMs: 1_800_000_000_100, slot: 10 },
      { price: 77_101, sourceTimestampMs: 1_800_000_000_900, slot: 11 },
      { price: 77_102, sourceTimestampMs: 1_800_000_001_100, slot: 12 },
    ];
    expect(toChartPoints(samples)).toEqual([
      { time: 1_800_000_000.1, value: 77_100 },
      { time: 1_800_000_000.9, value: 77_101 },
      { time: 1_800_000_001.1, value: 77_102 },
    ]);
  });
});
