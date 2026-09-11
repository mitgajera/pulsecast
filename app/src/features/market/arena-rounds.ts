import type { PublicRound } from "@pulsecast/shared";

import type { MarketPhase, MarketRound } from "./fixtures";

export type ArenaSelection = {
  current: PublicRound | null;
  next: PublicRound | null;
  previous: PublicRound | null;
};

export function selectArenaRounds(rounds: PublicRound[], nowSeconds: number): ArenaSelection {
  const ordered = [...rounds].sort((left, right) => left.openAt - right.openAt);
  return {
    current: ordered.find((round) => round.openAt <= nowSeconds && nowSeconds < round.resolveAt && round.status !== "cancelled") ?? null,
    next: ordered.find((round) => round.openAt > nowSeconds) ?? null,
    previous: ordered.filter((round) => round.resolveAt <= nowSeconds).at(-1) ?? null,
  };
}

export function toArenaRound(round: PublicRound, label: MarketRound["label"], nowSeconds: number): MarketRound {
  return {
    id: round.id,
    label,
    phase: effectivePhase(round, nowSeconds),
    openAt: round.openAt,
    lockAt: round.lockAt,
    resolveAt: round.resolveAt,
    openingPrice: scaledPrice(round.startPrice),
    ...(round.actualPrice !== "0" && { closingPrice: scaledPrice(round.actualPrice) }),
    entryAmountUsdc: atomicUsdc(round.entryAmount),
    poolUsdc: atomicUsdc(round.totalPool),
    predictions: round.predictionCount,
  };
}

function effectivePhase(round: PublicRound, nowSeconds: number): MarketPhase {
  if (round.status === "cancelled") return "cancelled";
  if (round.status === "settled") return "settled";
  if (nowSeconds < round.openAt) return "scheduled";
  if (nowSeconds < round.lockAt) return "betting";
  if (nowSeconds < round.resolveAt) return "watching";
  return "resolving";
}

function scaledPrice(raw: string) {
  return Number(BigInt(raw)) / 100_000_000;
}

function atomicUsdc(raw: string) {
  const value = BigInt(raw);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Round pool exceeds the supported display range");
  return Number(value) / 1_000_000;
}
