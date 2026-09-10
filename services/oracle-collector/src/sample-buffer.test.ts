import { describe, expect, it } from "vitest";

import { SampleBuffer } from "./sample-buffer.js";

const sample = (sourceTimestampMs: number, price = 100, slot = sourceTimestampMs) => ({ price, sourceTimestampMs, slot });

describe("SampleBuffer", () => {
  it("deduplicates samples and preserves chronological order", () => {
    const buffer = new SampleBuffer(4);
    expect(buffer.add(sample(2))).toBe(true);
    expect(buffer.add(sample(1))).toBe(true);
    expect(buffer.add(sample(2))).toBe(false);
    expect(buffer.history().map(({ sourceTimestampMs }) => sourceTimestampMs)).toEqual([1, 2]);
  });

  it("evicts old samples at capacity", () => {
    const buffer = new SampleBuffer(2);
    buffer.add(sample(1));
    buffer.add(sample(2));
    buffer.add(sample(3));
    expect(buffer.history()).toEqual([sample(2), sample(3)]);
  });

  it("returns a bounded history window", () => {
    const buffer = new SampleBuffer();
    buffer.add(sample(100));
    buffer.add(sample(200));
    expect(buffer.history(150)).toEqual([sample(200)]);
    expect(buffer.latest()).toEqual(sample(200));
  });
});
