"use client";

import { useState } from "react";

import { usePulseCastAuth } from "@/features/auth/auth-context";
import { useSponsoredEntry } from "@/features/prediction/use-sponsored-entry";

type TicketState = "idle" | "reviewing" | "preparing" | "signing" | "confirmed" | "error";

export function ForecastTicket({ roundId, stakeUsdc, watching }: { roundId: string; stakeUsdc: number; watching: boolean }) {
  const auth = usePulseCastAuth();
  const { enterMarket } = useSponsoredEntry();
  const [forecast, setForecast] = useState("112920.00");
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [state, setState] = useState<TicketState>("idle");
  const busy = state === "preparing" || state === "signing";

  function reviewPrediction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.authenticated) {
      auth.login();
      return;
    }
    const parsed = Number(forecast);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setState("error");
      setMessage("Enter a valid BTC price above zero.");
      return;
    }
    setMessage("");
    setState("reviewing");
  }

  async function confirmEntry() {
    if (!auth.address) return;
    setMessage("");
    try {
      const predictedPrice = BigInt(Math.round(Number(forecast) * 100_000_000)).toString();
      const nextSignature = await enterMarket(roundId, auth.address, predictedPrice, setState);
      setSignature(nextSignature);
      setState("confirmed");
    } catch (error) {
      setState("error");
      const text = error instanceof Error ? error.message : "The transaction could not be completed.";
      setMessage(/reject|cancel/i.test(text) ? "Signature cancelled. Your USDC was not moved." : text);
    }
  }

  const unavailable = watching || !auth.configured || !auth.ready || busy || state === "confirmed";
  const actionLabel = watching
    ? "Betting closed"
    : !auth.configured
      ? "Auth setup required"
      : !auth.ready
        ? "Checking account..."
        : state === "preparing"
          ? "Preparing entry..."
          : state === "signing"
            ? "Confirm in wallet..."
            : state === "confirmed"
              ? "Entry confirmed"
              : auth.authenticated
                ? "Review prediction"
                : "Sign in to predict";

  return (
    <section className="border bg-card" aria-labelledby="forecast-title">
      <div className="border-b px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Your call</p>
        <h2 className="mt-1 text-lg font-semibold" id="forecast-title">Predict the close</h2>
      </div>
      <form className="space-y-5 p-5" onSubmit={reviewPrediction}>
        <div>
          <label className="text-sm font-medium" htmlFor="forecast-price">BTC price at resolution</label>
          <div className="mt-2 flex min-h-12 items-center border bg-input focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
            <span className="pl-3 font-mono text-muted-foreground" aria-hidden="true">$</span>
            <input
              aria-describedby="forecast-help forecast-message"
              aria-invalid={state === "error" ? true : undefined}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-2 py-3 font-mono text-lg tabular-nums outline-none"
              disabled={watching || busy || state === "confirmed"}
              id="forecast-price"
              inputMode="decimal"
              onChange={(event) => { setForecast(event.target.value); setState("idle"); }}
              spellCheck={false}
              type="text"
              value={forecast}
            />
            <span className="pr-3 text-xs font-medium text-muted-foreground">USD</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground" id="forecast-help">Closest prediction shares the devnet USDC pool.</p>
          <p className={`mt-2 min-h-5 text-xs ${state === "error" ? "text-destructive" : "text-chart-4"}`} id="forecast-message" role="status">
            {watching ? "Predictions are locked for this round." : message}
          </p>
        </div>
        <label className="block text-sm font-medium" htmlFor="stake">
          Stake
          <div className="mt-2 flex min-h-12 items-center border bg-input">
            <input className="min-w-0 flex-1 bg-transparent px-3 py-3 font-mono tabular-nums outline-none" readOnly id="stake" inputMode="decimal" type="text" value={stakeUsdc.toFixed(2)} />
            <span className="pr-3 text-xs font-medium text-muted-foreground">USDC</span>
          </div>
        </label>

        {state === "reviewing" ? (
          <div className="space-y-4 border bg-muted/40 p-4" role="group" aria-label="Confirm market entry">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Forecast</dt><dd className="font-mono tabular-nums">${Number(forecast).toLocaleString("en-US", { minimumFractionDigits: 2 })}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Entry</dt><dd className="font-mono tabular-nums">{stakeUsdc.toFixed(2)} USDC</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Network fee</dt><dd>Sponsored</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Program</dt><dd>PulseCast</dd></div>
            </dl>
            <p className="text-xs leading-5 text-muted-foreground">One signature enters the market, moves the fixed devnet USDC stake, and records your forecast atomically.</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="min-h-11 border px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => setState("idle")} type="button">Back</button>
              <button className="min-h-11 bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => void confirmEntry()} type="button">Confirm entry</button>
            </div>
          </div>
        ) : (
          <button aria-busy={busy} className="min-h-12 w-full bg-primary px-4 font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45" disabled={unavailable} type="submit">
            {actionLabel}
          </button>
        )}

        {state === "confirmed" && (
          <div className="border border-chart-3/40 bg-chart-3/10 p-4 text-sm" role="status">
            <p className="font-medium">USDC entry confirmed</p>
            <p className="mt-1 text-xs text-muted-foreground">Your entry and forecast are confirmed together on devnet.</p>
            <a className="mt-3 inline-flex min-h-10 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} rel="noreferrer" target="_blank">View transaction ↗</a>
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">Gas sponsored · No SOL required</p>
      </form>
    </section>
  );
}
