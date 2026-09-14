export type PortfolioTrade = {
  actualPrice: number | null;
  payoutUsdc: number | null;
  predictedPrice: number;
  roundId: string;
  stakeUsdc: number;
  status: string;
  submittedAt: number;
};

const ledgerKey = (wallet: string) => `pulsecast:portfolio:${wallet}`;

export function loadPortfolioLedger(wallet: string): PortfolioTrade[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ledgerKey(wallet)) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPortfolioTrade).sort((a, b) => b.submittedAt - a.submittedAt);
  } catch {
    return [];
  }
}

export function savePortfolioTrade(wallet: string, trade: PortfolioTrade): PortfolioTrade[] {
  const current = loadPortfolioLedger(wallet);
  const existing = current.find((item) => item.roundId === trade.roundId);
  const next = [existing ? { ...existing, ...trade } : trade, ...current.filter((item) => item.roundId !== trade.roundId)]
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, 5_000);
  window.localStorage.setItem(ledgerKey(wallet), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("pulsecast:portfolio-updated"));
  return next;
}

export function mergePortfolioTrades(wallet: string, trades: PortfolioTrade[]): PortfolioTrade[] {
  const merged = trades.reduce((ledger, trade) => {
    const existing = ledger.find((item) => item.roundId === trade.roundId);
    const nextTrade = existing ? { ...existing, ...trade } : trade;
    return [nextTrade, ...ledger.filter((item) => item.roundId !== trade.roundId)];
  }, loadPortfolioLedger(wallet)).sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 5_000);
  window.localStorage.setItem(ledgerKey(wallet), JSON.stringify(merged));
  return merged;
}

function isPortfolioTrade(value: unknown): value is PortfolioTrade {
  if (!value || typeof value !== "object") return false;
  const trade = value as Partial<PortfolioTrade>;
  return typeof trade.roundId === "string"
    && typeof trade.predictedPrice === "number"
    && typeof trade.stakeUsdc === "number"
    && typeof trade.status === "string"
    && typeof trade.submittedAt === "number"
    && (trade.actualPrice === null || typeof trade.actualPrice === "number")
    && (trade.payoutUsdc === null || typeof trade.payoutUsdc === "number");
}
