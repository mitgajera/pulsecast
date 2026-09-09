import { PublicKey } from "@solana/web3.js";

export const PULSECAST_PROGRAM_ID = new PublicKey(
  "4UVCJQeggToFwbNx4QgbAvFe1cpQ3aUWRVkYV19VJUQu",
);
export const DEVNET_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
export const MAGICBLOCK_BTC_FEED = new PublicKey(
  "71wtTRDY8Gxgw56bXFt2oc6qeAbTxzStdNiC425Z51sr",
);
export const MAGICBLOCK_TEE_VALIDATOR = new PublicKey(
  "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo",
);

export const CONFIG_SEED = "config";
export const ORACLE_SNAPSHOT_SEED = "oracle_snapshot";
export const PREDICTION_SEED = "prediction";
export const ROUND_SEED = "round";

export const BETTING_SECONDS = 30;
export const MARKET_SECONDS = 60;
export const MAX_PARTICIPANTS = 16;
