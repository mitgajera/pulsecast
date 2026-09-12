import { z } from "zod";

export const sponsoredActionSchema = z.enum([
  "enter_market",
  "setup_prediction",
  "claim_payout",
  "claim_refund",
  "withdraw_usdc",
]);

const operationBaseSchema = z.object({
  idempotencyKey: z.string().uuid(),
  roundId: z.string().regex(/^\d+$/),
  wallet: z.string().min(32).max(44),
});

export const prepareOperationSchema = z.discriminatedUnion("action", [
  operationBaseSchema.extend({
    action: z.literal("enter_market"),
    predictedPrice: z.string().regex(/^[1-9]\d*$/),
  }),
  operationBaseSchema.extend({
    action: z.literal("setup_prediction"),
    predictedPrice: z.string().regex(/^\d+$/),
  }),
  operationBaseSchema.extend({ action: z.literal("claim_payout") }),
  operationBaseSchema.extend({ action: z.literal("claim_refund") }),
  z.object({
    action: z.literal("withdraw_usdc"),
    amount: z.string().regex(/^[1-9]\d*$/),
    destination: z.string().min(32).max(44),
    idempotencyKey: z.string().uuid(),
    wallet: z.string().min(32).max(44),
  }),
]);

export const operationStateSchema = z.enum([
  "prepared",
  "awaiting_signature",
  "submitted",
  "confirmed",
  "failed",
  "expired",
]);

export const preparedOperationSchema = z.object({
  expiresAt: z.number().int().positive(),
  operationId: z.string().uuid(),
  state: z.literal("awaiting_signature"),
  transaction: z.string().min(1),
});

export type PrepareOperation = z.infer<typeof prepareOperationSchema>;
export type SponsoredAction = z.infer<typeof sponsoredActionSchema>;
export type OperationState = z.infer<typeof operationStateSchema>;
export type PreparedOperation = z.infer<typeof preparedOperationSchema>;
