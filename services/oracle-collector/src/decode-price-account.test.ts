import { describe, expect, it } from "vitest";

import { decodePriceAccount } from "./decode-price-account.js";

function accountBytes({ exponent = 8, price = 11_290_712_345_678n, publishTime = 1_800_000_000n, slot = 580_000_000n } = {}) {
  const data = new Uint8Array(134);
  const view = new DataView(data.buffer);
  view.setBigInt64(73, price, true);
  view.setInt32(89, exponent, true);
  view.setBigInt64(93, publishTime, true);
  view.setBigUint64(125, slot, true);
  return data;
}

describe("MagicBlock price account decoder", () => {
  it("decodes signed BTC price, exponent, timestamp, and slot", () => {
    expect(decodePriceAccount(accountBytes())).toEqual({
      price: 112_907.12345678,
      sourceTimestampMs: 1_800_000_000_000,
      slot: 580_000_000,
    });
  });

  it("rejects truncated and invalid account values", () => {
    expect(() => decodePriceAccount(new Uint8Array(100))).toThrow("too short");
    expect(() => decodePriceAccount(accountBytes({ exponent: -30 }))).toThrow("supported range");
    expect(() => decodePriceAccount(accountBytes({ price: -1n }))).toThrow();
  });

  it("accepts the signed registry form of the exponent", () => {
    expect(decodePriceAccount(accountBytes({ exponent: -8 })).price).toBe(112_907.12345678);
  });
});
