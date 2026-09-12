import { createHash } from "node:crypto";

import { PublicKey } from "@solana/web3.js";

export const PREDICTION_ACCOUNT_SIZE = 195;
export const PREDICTION_ACCOUNT_DISCRIMINATOR = createHash("sha256").update("account:Prediction").digest().subarray(0, 8);

export type DecodedPredictionAccount = {
  round: PublicKey;
  user: PublicKey;
  sponsor: PublicKey;
  predictedPrice: bigint;
  submittedAt: bigint;
  error: bigint;
  score: bigint;
  payout: bigint;
  scored: boolean;
  claimed: boolean;
};

export function decodePredictionAccount(data: Uint8Array): DecodedPredictionAccount {
  if (data.byteLength !== PREDICTION_ACCOUNT_SIZE) throw new Error(`Unsupported prediction account size: ${data.byteLength}`);
  if (!PREDICTION_ACCOUNT_DISCRIMINATOR.every((byte, index) => data[index] === byte)) throw new Error("Prediction account discriminator does not match");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    round: new PublicKey(data.slice(8, 40)),
    user: new PublicKey(data.slice(40, 72)),
    sponsor: new PublicKey(data.slice(72, 104)),
    predictedPrice: view.getBigInt64(152, true),
    submittedAt: view.getBigInt64(160, true),
    error: view.getBigUint64(168, true),
    score: view.getBigUint64(176, true),
    payout: view.getBigUint64(184, true),
    scored: view.getUint8(192) !== 0,
    claimed: view.getUint8(193) !== 0,
  };
}
