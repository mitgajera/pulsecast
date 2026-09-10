import { oracleSampleSchema, type OracleSample } from "@pulsecast/shared";

const minimumAccountLength = 133;
const priceOffset = 73;
const exponentOffset = 89;
const publishTimeOffset = 93;
const postedSlotOffset = 125;

export function decodePriceAccount(data: Uint8Array): OracleSample {
  if (data.byteLength < minimumAccountLength) {
    throw new Error(`Oracle account is too short: expected at least ${minimumAccountLength} bytes`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const rawPrice = view.getBigInt64(priceOffset, true);
  const storedExponent = view.getInt32(exponentOffset, true);
  const publishTime = view.getBigInt64(publishTimeOffset, true);
  const postedSlot = view.getBigUint64(postedSlotOffset, true);

  if (storedExponent < -18 || storedExponent > 18) throw new Error(`Oracle exponent is outside the supported range: ${storedExponent}`);
  if (publishTime < 0n || publishTime > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Oracle publish time is invalid");
  if (postedSlot > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Oracle slot exceeds JavaScript's safe integer range");

  return oracleSampleSchema.parse({
    // MagicBlock's PriceUpdateV3 currently stores precision as positive 8,
    // while the Pyth registry represents the same scale as exponent -8.
    price: Number(rawPrice) * 10 ** -Math.abs(storedExponent),
    sourceTimestampMs: Number(publishTime) * 1_000,
    slot: Number(postedSlot),
  });
}
