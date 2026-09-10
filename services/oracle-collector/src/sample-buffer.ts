import type { OracleSample } from "@pulsecast/shared";

export class SampleBuffer {
  readonly #capacity: number;
  readonly #keys = new Set<string>();
  #samples: OracleSample[] = [];

  constructor(capacity = 6_000) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Sample buffer capacity must be a positive integer");
    this.#capacity = capacity;
  }

  add(sample: OracleSample) {
    const key = sampleKey(sample);
    if (this.#keys.has(key)) return false;

    this.#samples.push(sample);
    this.#keys.add(key);
    this.#samples.sort((left, right) => left.sourceTimestampMs - right.sourceTimestampMs || left.slot - right.slot);

    while (this.#samples.length > this.#capacity) {
      const removed = this.#samples.shift();
      if (removed) this.#keys.delete(sampleKey(removed));
    }
    return true;
  }

  history(sinceMs = 0, limit = 1_200) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("History limit must be a positive integer");
    return this.#samples.filter((sample) => sample.sourceTimestampMs >= sinceMs).slice(-limit);
  }

  latest() {
    return this.#samples.at(-1);
  }

  get size() {
    return this.#samples.length;
  }
}

function sampleKey(sample: OracleSample) {
  return `${sample.sourceTimestampMs}:${sample.price}`;
}
