"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";

import { usePulseCastAuth } from "@/features/auth/auth-context";

type RoundResult = { actualPrice: number | null; claimed: boolean; entryAmountUsdc: number; error: number | null; payoutUsdc: number; predictedPrice: number; roundId: string; status: string };
const usd = new Intl.NumberFormat("en-US", { currency: "USD", style: "currency", minimumFractionDigits: 2 });
const usdc = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });

export function RoundResultDialog({ roundId }: { roundId: string | null }) {
  const auth = usePulseCastAuth();
  const { getAccessToken } = usePrivy();
  const dialog = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<RoundResult | null>(null);

  useEffect(() => {
    if (!roundId || !auth.authenticated || !auth.address) return;
    const dismissedKey = `pulsecast:result:${auth.address}:${roundId}`;
    if (window.localStorage.getItem(dismissedKey)) return;
    let stopped = false;
    async function check() {
      try {
        const token = await getAccessToken();
        const response = await fetch(`/api/account?wallet=${encodeURIComponent(auth.address!)}`, { cache: "no-store", headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const payload = await response.json() as { predictions?: RoundResult[] };
        const match = payload.predictions?.find((item) => item.roundId === roundId && (item.status === "settled" || item.status === "cancelled"));
        if (match && !stopped) setResult(match);
      } catch { /* The next poll retries transient RPC failures. */ }
    }
    void check();
    const interval = window.setInterval(() => void check(), 1_000);
    return () => { stopped = true; window.clearInterval(interval); };
  }, [auth.address, auth.authenticated, getAccessToken, roundId]);

  useEffect(() => {
    if (result && !dialog.current?.open) dialog.current?.showModal();
  }, [result]);

  if (!result || !roundId || !auth.address) return null;
  const net = result.payoutUsdc - result.entryAmountUsdc;
  const profitable = net > 0;
  function dismiss() {
    window.localStorage.setItem(`pulsecast:result:${auth.address}:${roundId}`, "dismissed");
    dialog.current?.close();
  }

  return <dialog aria-labelledby="round-result-title" className="m-auto w-[calc(100%-2rem)] max-w-md border bg-card p-0 text-foreground shadow-2xl backdrop:bg-background/80" onClose={dismiss} ref={dialog}><div className="border-b p-5"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Round {roundId} resolved</p><h2 className="mt-1 text-2xl font-semibold" id="round-result-title">{profitable ? `You earned ${usdc.format(net)} USDC` : net === 0 ? "Your stake was returned" : `Net result: −${usdc.format(Math.abs(net))} USDC`}</h2></div><dl className="grid grid-cols-2 gap-px bg-border"><ResultStat label="Your prediction" value={usd.format(result.predictedPrice)} /><ResultStat label="Closing price" value={result.actualPrice === null ? "Unavailable" : usd.format(result.actualPrice)} /><ResultStat label="Precision error" value={result.error === null ? "Unavailable" : usd.format(result.error)} /><ResultStat label="Stake" value={`${usdc.format(result.entryAmountUsdc)} USDC`} /><ResultStat label="Total return" value={`${usdc.format(result.payoutUsdc)} USDC`} /><ResultStat label="Net P/L" value={`${net >= 0 ? "+" : "−"}${usdc.format(Math.abs(net))} USDC`} /></dl><div className="grid grid-cols-2 gap-2 p-5"><button className="min-h-11 border font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={dismiss} type="button">Close</button><a className="flex min-h-11 items-center justify-center bg-primary font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href="/profile">{result.claimed ? "View account" : "Claim return"}</a></div></dialog>;
}

function ResultStat({ label, value }: { label: string; value: string }) { return <div className="bg-card p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</dd></div>; }
