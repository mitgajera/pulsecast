export type MarketPhase = "settled" | "betting" | "watching" | "scheduled";

export type MarketRound = {
  id: string;
  label: "Previous" | "Live" | "Next";
  phase: MarketPhase;
  openAt: number;
  lockAt: number;
  resolveAt: number;
  openingPrice: number;
  closingPrice?: number;
  poolUsdc: number;
  predictions: number;
};

const fixturePrice = 112_842.18;

export function createMarketFixture(nowMs: number): MarketRound[] {
  const currentOpenAt = Math.floor(nowMs / 60_000) * 60;

  return [
    {
      id: String(currentOpenAt - 60),
      label: "Previous",
      phase: "settled",
      openAt: currentOpenAt - 60,
      lockAt: currentOpenAt - 30,
      resolveAt: currentOpenAt,
      openingPrice: 112_798.42,
      closingPrice: 112_842.18,
      poolUsdc: 1_284.5,
      predictions: 186,
    },
    {
      id: String(currentOpenAt),
      label: "Live",
      phase: nowMs < (currentOpenAt + 30) * 1_000 ? "betting" : "watching",
      openAt: currentOpenAt,
      lockAt: currentOpenAt + 30,
      resolveAt: currentOpenAt + 60,
      openingPrice: fixturePrice,
      poolUsdc: 862.25,
      predictions: 124,
    },
    {
      id: String(currentOpenAt + 60),
      label: "Next",
      phase: "scheduled",
      openAt: currentOpenAt + 60,
      lockAt: currentOpenAt + 90,
      resolveAt: currentOpenAt + 120,
      openingPrice: fixturePrice,
      poolUsdc: 0,
      predictions: 0,
    },
  ];
}
