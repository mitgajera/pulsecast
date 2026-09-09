import { z } from "zod";

export const roundStatusSchema = z.enum([
  "scheduled",
  "betting",
  "watching",
  "resolved",
  "settled",
  "cancelled",
]);

export type RoundStatus = z.infer<typeof roundStatusSchema>;

export const marketPhaseSchema = z.enum([
  "scheduled",
  "betting",
  "watching",
  "resolving",
  "settled",
  "cancelled",
]);

export type MarketPhase = z.infer<typeof marketPhaseSchema>;

export const marketScheduleSchema = z
  .object({
    openAt: z.number().int(),
    lockAt: z.number().int(),
    resolveAt: z.number().int(),
  })
  .refine(({ openAt, lockAt }) => lockAt === openAt + 30, {
    message: "lockAt must be 30 seconds after openAt",
    path: ["lockAt"],
  })
  .refine(({ openAt, resolveAt }) => resolveAt === openAt + 60, {
    message: "resolveAt must be 60 seconds after openAt",
    path: ["resolveAt"],
  });

export type MarketSchedule = z.infer<typeof marketScheduleSchema>;

export function phaseAt(schedule: MarketSchedule, unixSeconds: number): MarketPhase {
  if (unixSeconds < schedule.openAt) return "scheduled";
  if (unixSeconds < schedule.lockAt) return "betting";
  if (unixSeconds < schedule.resolveAt) return "watching";
  return "resolving";
}
