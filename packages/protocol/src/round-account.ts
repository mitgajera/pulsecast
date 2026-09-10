export const ROUND_ACCOUNT_DISCRIMINATOR = Uint8Array.from([87, 127, 165, 51, 73, 78, 116, 174]);
export const ROUND_ACCOUNT_DISCRIMINATOR_BASE58 = "Fdr5W8SQEA9";
export const LEGACY_ROUND_ACCOUNT_SIZE = 114;
export const ROUND_ACCOUNT_SIZE = 116;

export const roundStatuses = ["scheduled", "betting", "watching", "resolved", "settled", "cancelled"] as const;
export type OnchainRoundStatus = (typeof roundStatuses)[number];

export type DecodedRoundAccount = {
  actualPrice: bigint;
  actualPublishTime: bigint;
  bump: number;
  claimedCount: number;
  entryAmount: bigint;
  feeBps: number;
  id: bigint;
  lockAt: bigint;
  maxErrorBps: number;
  openAt: bigint;
  predictionCount: number;
  protocolFee: bigint;
  resolveAt: bigint;
  schemaVersion: "current" | "legacy-without-claims";
  scoredCount: number;
  startPrice: bigint;
  startPublishTime: bigint;
  status: OnchainRoundStatus;
  totalPool: bigint;
  totalScore: bigint;
};

export function decodeRoundAccount(data: Uint8Array): DecodedRoundAccount {
  if (data.byteLength !== ROUND_ACCOUNT_SIZE && data.byteLength !== LEGACY_ROUND_ACCOUNT_SIZE) {
    throw new Error(`Unsupported round account size: ${data.byteLength}`);
  }
  if (!ROUND_ACCOUNT_DISCRIMINATOR.every((byte, index) => data[index] === byte)) {
    throw new Error("Round account discriminator does not match");
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8;
  const u64 = () => { const value = view.getBigUint64(offset, true); offset += 8; return value; };
  const i64 = () => { const value = view.getBigInt64(offset, true); offset += 8; return value; };
  const u16 = () => { const value = view.getUint16(offset, true); offset += 2; return value; };

  const id = u64();
  const status = roundStatuses[view.getUint8(offset++)];
  if (!status) throw new Error("Round account contains an unknown status");

  const decoded = {
    id,
    status,
    openAt: i64(),
    lockAt: i64(),
    resolveAt: i64(),
    startPrice: i64(),
    startPublishTime: i64(),
    actualPrice: i64(),
    actualPublishTime: i64(),
    totalPool: u64(),
    totalScore: u64(),
    protocolFee: u64(),
    predictionCount: u16(),
    scoredCount: u16(),
  };
  const current = data.byteLength === ROUND_ACCOUNT_SIZE;

  return {
    ...decoded,
    claimedCount: current ? u16() : 0,
    entryAmount: u64(),
    feeBps: u16(),
    maxErrorBps: u16(),
    bump: view.getUint8(offset),
    schemaVersion: current ? "current" : "legacy-without-claims",
  };
}
