import { z } from "zod";

export const oracleSampleSchema = z.object({
  price: z.number().positive().finite(),
  sourceTimestampMs: z.number().int().nonnegative(),
  slot: z.number().int().nonnegative(),
});

export const marketHistorySchema = z.object({
  roundId: z.string().regex(/^\d+$/),
  samples: z.array(oracleSampleSchema).max(1_200),
  serverTimeMs: z.number().int().nonnegative(),
  source: z.enum(["fixture", "magicblock"]),
});

export type OracleSample = z.infer<typeof oracleSampleSchema>;
export type MarketHistory = z.infer<typeof marketHistorySchema>;
