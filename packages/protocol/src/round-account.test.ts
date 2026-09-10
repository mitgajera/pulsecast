import { describe, expect, it } from "vitest";

import { decodeRoundAccount, LEGACY_ROUND_ACCOUNT_SIZE, ROUND_ACCOUNT_DISCRIMINATOR, ROUND_ACCOUNT_SIZE } from "./round-account";

function encodedRound(current: boolean) {
  const data = new Uint8Array(current ? ROUND_ACCOUNT_SIZE : LEGACY_ROUND_ACCOUNT_SIZE);
  data.set(ROUND_ACCOUNT_DISCRIMINATOR);
  const view = new DataView(data.buffer);
  let offset = 8;
  const u64 = (value: bigint) => { view.setBigUint64(offset, value, true); offset += 8; };
  const i64 = (value: bigint) => { view.setBigInt64(offset, value, true); offset += 8; };
  const u16 = (value: number) => { view.setUint16(offset, value, true); offset += 2; };
  u64(42n); view.setUint8(offset++, 2);
  [120n, 150n, 180n, 77_000_00000000n, 121n, 77_100_00000000n, 180n].forEach(i64);
  [1_000_000n, 500n, 10_000n].forEach(u64);
  u16(12); u16(12); if (current) u16(4);
  u64(100_000n); u16(100); u16(250); view.setUint8(offset, 254);
  return data;
}

describe("round account decoder", () => {
  it("decodes the current round layout", () => {
    expect(decodeRoundAccount(encodedRound(true))).toMatchObject({ id: 42n, status: "watching", claimedCount: 4, entryAmount: 100_000n, schemaVersion: "current" });
  });

  it("decodes deployed legacy rounds without shifting later fields", () => {
    expect(decodeRoundAccount(encodedRound(false))).toMatchObject({ claimedCount: 0, entryAmount: 100_000n, feeBps: 100, maxErrorBps: 250, bump: 254, schemaVersion: "legacy-without-claims" });
  });

  it("rejects unknown layouts and discriminators", () => {
    expect(() => decodeRoundAccount(new Uint8Array(10))).toThrow("size");
    const data = encodedRound(true); data[0] = 0;
    expect(() => decodeRoundAccount(data)).toThrow("discriminator");
  });
});
