import { describe, expect, it } from "vitest";

import {
  deriveConfigAddress,
  deriveOracleSnapshotAddress,
  deriveRoundAddress,
} from "./pdas";

describe("PulseCast PDA derivation", () => {
  it("matches the canonical Rust seed layout", () => {
    const [config] = deriveConfigAddress();
    const [round] = deriveRoundAddress(1n);
    const [snapshot] = deriveOracleSnapshotAddress(round);

    expect(config.toBase58()).toBe("BH28EZg8PhB2Ch4RGjbdiQTcwnN4Hi7SPJvMxUShc1pA");
    expect(round.toBase58()).toBe("HW4hyrLJrxs8UVqpRyBvoQK2s3dieyEemDNeBTiZsQYP");
    expect(snapshot.toBase58()).toBe("8wPUsExt5ftnCfQxwc25pb5XpgQnDRmvoNs3weXWxrvs");
  });

  it("rejects invalid u64 round identifiers", () => {
    expect(() => deriveRoundAddress(-1n)).toThrow(RangeError);
    expect(() => deriveRoundAddress(1n << 64n)).toThrow(RangeError);
  });
});
