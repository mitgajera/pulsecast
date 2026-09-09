import { describe, expect, it } from "vitest";

import { createOracleHistory, mergeOracleHistory, mergeOracleSamples, nextFixtureSample } from "./oracle-sample";

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
});
