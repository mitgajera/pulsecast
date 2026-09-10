import { z } from "zod";

export const publicRoundSchema = z.object({
  account: z.string().min(32).max(44),
  actualPrice: z.string().regex(/^-?\d+$/),
  actualPublishTime: z.number().int(),
  entryAmount: z.string().regex(/^\d+$/),
  feeBps: z.number().int().min(0).max(10_000),
  id: z.string().regex(/^\d+$/),
  lockAt: z.number().int(),
  maxErrorBps: z.number().int().min(0).max(10_000),
  openAt: z.number().int(),
  predictionCount: z.number().int().nonnegative(),
  resolveAt: z.number().int(),
  schemaVersion: z.enum(["current", "legacy-without-claims"]),
  startPrice: z.string().regex(/^-?\d+$/),
  startPublishTime: z.number().int(),
  status: z.enum(["scheduled", "betting", "watching", "resolved", "settled", "cancelled"]),
  totalPool: z.string().regex(/^\d+$/),
});

export const roundIndexSchema = z.object({
  rounds: z.array(publicRoundSchema).max(100),
  serverTimeMs: z.number().int().nonnegative(),
  source: z.literal("solana-devnet"),
});

export type PublicRound = z.infer<typeof publicRoundSchema>;
export type RoundIndex = z.infer<typeof roundIndexSchema>;
