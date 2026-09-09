import { PublicKey } from "@solana/web3.js";

import {
  CONFIG_SEED,
  ORACLE_SNAPSHOT_SEED,
  PREDICTION_SEED,
  PULSECAST_PROGRAM_ID,
  ROUND_SEED,
} from "./constants";

const encoder = new TextEncoder();

function u64Le(value: bigint): Uint8Array {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) {
    throw new RangeError("roundId must fit in an unsigned 64-bit integer");
  }
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytes;
}

export function deriveConfigAddress(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [encoder.encode(CONFIG_SEED)],
    PULSECAST_PROGRAM_ID,
  );
}

export function deriveRoundAddress(roundId: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [encoder.encode(ROUND_SEED), u64Le(roundId)],
    PULSECAST_PROGRAM_ID,
  );
}

export function deriveOracleSnapshotAddress(round: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [encoder.encode(ORACLE_SNAPSHOT_SEED), round.toBytes()],
    PULSECAST_PROGRAM_ID,
  );
}

export function derivePredictionAddress(
  round: PublicKey,
  user: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [encoder.encode(PREDICTION_SEED), round.toBytes(), user.toBytes()],
    PULSECAST_PROGRAM_ID,
  );
}
