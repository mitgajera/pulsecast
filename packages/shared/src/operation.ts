import { z } from "zod";

export const sponsoredActionSchema = z.enum([
  "enter_market",
  "setup_prediction",
  "claim_payout",
  "claim_refund",
]);

export const prepareOperationSchema = z.object({
  action: sponsoredActionSchema,
  idempotencyKey: z.string().uuid(),
  roundId: z.string().regex(/^\d+$/),
  wallet: z.string().min(32).max(44),
});

export const operationStateSchema = z.enum([
  "prepared",
  "awaiting_signature",
  "submitted",
  "confirmed",
  "failed",
  "expired",
]);

export type PrepareOperation = z.infer<typeof prepareOperationSchema>;
export type SponsoredAction = z.infer<typeof sponsoredActionSchema>;
export type OperationState = z.infer<typeof operationStateSchema>;
