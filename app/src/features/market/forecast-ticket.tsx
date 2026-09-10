"use client";

import { useState } from "react";

import { usePulseCastAuth } from "@/features/auth/auth-context";

export function ForecastTicket({ watching }: { watching: boolean }) {
  const auth = usePulseCastAuth();
  const [forecast, setForecast] = useState("112920.00");
  const [message, setMessage] = useState("");

  function preparePrediction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.authenticated) {
      auth.login();
      return;
    }

    const parsed = Number(forecast);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setMessage("Enter a valid BTC price above zero.");
      return;
    }
    setMessage("Wallet ready. Transaction preparation is the next integration step.");
  }

  const unavailable = watching || !auth.configured || !auth.ready;
  const actionLabel = watching
    ? "Betting closed"
    : !auth.configured
      ? "Auth setup required"
      : !auth.ready
        ? "Checking account..."
        : auth.authenticated
          ? "Prepare prediction"
          : "Sign in to predict";

  return (
    <section className="border bg-card" aria-labelledby="forecast-title">
      <div className="border-b px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Your call</p>
        <h2 className="mt-1 text-lg font-semibold" id="forecast-title">Predict the close</h2>
      </div>
      <form className="space-y-5 p-5" onSubmit={preparePrediction}>
        <div>
          <label className="text-sm font-medium" htmlFor="forecast-price">BTC price at resolution</label>
          <div className="mt-2 flex min-h-12 items-center border bg-input focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
            <span className="pl-3 font-mono text-muted-foreground" aria-hidden="true">$</span>
            <input
              aria-describedby="forecast-help forecast-message"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-2 py-3 font-mono text-lg tabular-nums outline-none"
              disabled={watching}
              id="forecast-price"
              inputMode="decimal"
              onChange={(event) => setForecast(event.target.value)}
              spellCheck={false}
              type="text"
              value={forecast}
            />
            <span className="pr-3 text-xs font-medium text-muted-foreground">USD</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground" id="forecast-help">Closest prediction shares the devnet USDC pool.</p>
          <p className="mt-2 min-h-5 text-xs text-chart-4" id="forecast-message" role="status">
            {watching ? "Predictions are locked for this round." : message}
          </p>
        </div>
        <label className="block text-sm font-medium" htmlFor="stake">
          Stake
          <div className="mt-2 flex min-h-12 items-center border bg-input">
            <input className="min-w-0 flex-1 bg-transparent px-3 py-3 font-mono tabular-nums outline-none" defaultValue="10.00" disabled id="stake" inputMode="decimal" type="text" />
            <span className="pr-3 text-xs font-medium text-muted-foreground">USDC</span>
          </div>
        </label>
        <button
          aria-busy={!auth.ready}
          className="min-h-12 w-full bg-primary px-4 font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45"
          disabled={unavailable}
          type="submit"
        >
          {actionLabel}
        </button>
        <p className="text-center text-xs text-muted-foreground">Gas sponsored · No SOL required</p>
      </form>
    </section>
  );
}
