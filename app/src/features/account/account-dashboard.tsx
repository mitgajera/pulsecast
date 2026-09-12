"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { PublicKey } from "@solana/web3.js";
import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useMemo, useState } from "react";

import { usePulseCastAuth } from "@/features/auth/auth-context";
import { WalletAvatar } from "@/features/auth/wallet-avatar";
import { useAccountOperation } from "./use-account-operation";

type Prediction = { account: string; actualPrice: number | null; claimType: "claim_payout" | "claim_refund"; claimable: boolean; claimed: boolean; entryAmountUsdc: number; error: number | null; payoutUsdc: number; predictedPrice: number; roundId: string | null; status: string; submittedAt: number };
type AccountData = { balanceUsdc: number; tokenAccount: string; wallet: string; predictions: Prediction[] };
type LoadState = "idle" | "loading" | "ready" | "error";

const usdc = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const shortAddress = (value: string) => `${value.slice(0, 4)}...${value.slice(-4)}`;

export function AccountDashboard() {
  const auth = usePulseCastAuth();
  const { getAccessToken } = usePrivy();
  const { submit } = useAccountOperation();
  const [data, setData] = useState<AccountData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);

  const fetchAccount = useCallback(async () => {
    if (!auth.address) return;
    setLoadState("loading");
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/account?wallet=${encodeURIComponent(auth.address)}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Account data could not load.");
      setData(payload); setLoadState("ready");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account data could not load."); setLoadState("error"); }
  }, [auth.address, getAccessToken, setData, setLoadState, setMessage]);
  useEffect(() => {
    if (!auth.authenticated || !auth.address) return;
    const timeout = window.setTimeout(() => void fetchAccount(), 0);
    return () => window.clearTimeout(timeout);
  }, [auth.address, auth.authenticated, fetchAccount]);
  const claimable = useMemo(() => data?.predictions.filter((item) => item.claimable).reduce((sum, item) => sum + (item.claimType === "claim_refund" ? item.entryAmountUsdc : item.payoutUsdc), 0) ?? 0, [data]);

  if (!auth.ready) return <AccountSkeleton />;
  if (!auth.authenticated || !auth.address) return <section className="mx-auto max-w-lg border bg-card p-6 sm:p-8"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Account</p><h1 className="mt-2 text-2xl font-semibold">Sign in to view your portfolio</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Your Privy wallet holds your devnet USDC, predictions, and payouts.</p><button className="mt-6 min-h-11 bg-primary px-5 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={auth.login} type="button">Sign in</button></section>;
  if (loadState === "loading" || loadState === "idle") return <AccountSkeleton />;
  if (loadState === "error" || !data) return <section className="border bg-card p-6"><h1 className="text-xl font-semibold">Account data unavailable</h1><p className="mt-2 text-sm text-destructive" role="alert">{message}</p><button className="mt-5 min-h-10 border px-4 font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" onClick={() => void fetchAccount()} type="button">Retry</button></section>;
  const walletAddress = auth.address;
  const account = data;

  async function runClaim(item: Prediction) {
    if (!item.roundId) return;
    setBusy(item.account); setMessage("");
    try { await submit({ action: item.claimType, idempotencyKey: crypto.randomUUID(), roundId: item.roundId, wallet: walletAddress }); await fetchAccount(); setMessage(item.claimType === "claim_refund" ? "Refund claimed." : "Payout claimed."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Claim failed."); }
    finally { setBusy(null); }
  }
  function reviewWithdrawal(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    try { new PublicKey(destination); const atomic = Math.round(Number(amount) * 1_000_000); if (!Number.isSafeInteger(atomic) || atomic <= 0) throw new Error("Enter a valid USDC amount."); if (atomic > Math.round(account.balanceUsdc * 1_000_000)) throw new Error("Amount exceeds your available balance."); setConfirming(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Enter a valid Solana address."); }
  }
  async function withdraw() {
    setBusy("withdraw"); setMessage("");
    try { await submit({ action: "withdraw_usdc", amount: String(Math.round(Number(amount) * 1_000_000)), destination, idempotencyKey: crypto.randomUUID(), wallet: walletAddress }); setAmount(""); setDestination(""); setConfirming(false); await fetchAccount(); setMessage("Withdrawal confirmed on devnet."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Withdrawal failed."); }
    finally { setBusy(null); }
  }

  return <div className="space-y-4">
    <section className="grid border bg-card md:grid-cols-[1fr_auto] md:items-end"><div className="flex items-center gap-4 p-5 sm:p-6"><WalletAvatar address={walletAddress} size="lg" /><div><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Available balance</p><p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{usdc.format(account.balanceUsdc)} <span className="text-sm font-medium text-muted-foreground">USDC</span></p><p className="mt-2 font-mono text-xs text-muted-foreground">{shortAddress(walletAddress)}</p></div></div><dl className="grid grid-cols-2 border-t md:border-l md:border-t-0"><Stat label="Predictions" value={String(account.predictions.length)} /><Stat label="Claimable" value={`${usdc.format(claimable)} USDC`} /></dl></section>
    {message && <p className="border bg-card px-4 py-3 text-sm" role="status">{message}</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="border bg-card">
        <header className="border-b p-5"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Activity</p><h1 className="mt-1 text-xl font-semibold">Prediction history</h1></header>
        {account.predictions.length === 0 ? (
          <div className="p-8 text-center"><p className="font-medium">No predictions yet</p><p className="mt-2 text-sm text-muted-foreground">Enter a live minute market to start building your record.</p><a className="mt-5 inline-flex min-h-10 items-center text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring" href="/">View live market</a></div>
        ) : (
          <div className="divide-y">{account.predictions.map((item) => <PredictionRow busy={busy} item={item} key={item.account} onClaim={runClaim} />)}</div>
        )}
      </section>
      <aside className="h-fit border bg-card lg:sticky lg:top-20"><header className="border-b p-5"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Transfer</p><h2 className="mt-1 font-semibold">Withdraw USDC</h2></header><form className="space-y-4 p-5" onSubmit={reviewWithdrawal}><label className="block text-sm font-medium" htmlFor="destination">Destination wallet<input autoComplete="off" className="mt-2 min-h-11 w-full border bg-input px-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" id="destination" onChange={(event) => { setDestination(event.target.value.trim()); setConfirming(false); }} placeholder="Solana address" spellCheck={false} type="text" value={destination} /></label><label className="block text-sm font-medium" htmlFor="amount">Amount<div className="mt-2 flex min-h-11 border bg-input focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"><input className="min-w-0 flex-1 bg-transparent px-3 font-mono outline-none" id="amount" inputMode="decimal" onChange={(event) => { setAmount(event.target.value); setConfirming(false); }} placeholder="0.00" type="text" value={amount} /><span className="self-center pr-3 text-xs text-muted-foreground">USDC</span></div></label>{confirming ? <div className="space-y-3 border p-3"><p className="text-sm">Send <span className="font-mono">{amount} USDC</span> to <span className="font-mono">{shortAddress(destination)}</span>?</p><p className="text-xs text-muted-foreground">Network fee sponsored. This transfer cannot be reversed.</p><div className="grid grid-cols-2 gap-2"><button className="min-h-10 border text-sm" onClick={() => setConfirming(false)} type="button">Back</button><button aria-busy={busy === "withdraw"} className="min-h-10 bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={busy !== null} onClick={() => void withdraw()} type="button">{busy === "withdraw" ? "Sending…" : "Confirm"}</button></div></div> : <button className="min-h-11 w-full bg-primary font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" disabled={!amount || !destination || busy !== null} type="submit">Review withdrawal</button>}<p className="text-xs leading-5 text-muted-foreground">Transfers devnet USDC from your embedded wallet. SOL is not required.</p></form></aside>
    </div>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="min-w-36 p-5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</dd></div>; }
function PredictionRow({ busy, item, onClaim }: { busy: string | null; item: Prediction; onClaim: (item: Prediction) => Promise<void> }) {
  const resolved = item.actualPrice !== null;
  const result = item.claimType === "claim_refund"
    ? `${usdc.format(item.entryAmountUsdc)} USDC refund`
    : !resolved
      ? "Pending"
      : item.payoutUsdc > 0
        ? `${usdc.format(item.payoutUsdc)} USDC payout`
        : "No payout";
  return <article className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5"><div className="font-mono text-sm font-semibold">#{item.roundId ?? "—"}</div><div><p className="font-mono text-sm tabular-nums">Predicted {price.format(item.predictedPrice)}</p><p className="mt-1 text-xs text-muted-foreground">{resolved ? `Closed ${price.format(item.actualPrice!)}${item.error === null ? "" : ` · ${price.format(item.error)} away`}` : statusLabel(item.status)}</p></div><div className="sm:text-right"><p className="font-mono text-sm font-semibold tabular-nums">{result}</p>{item.claimable ? <button aria-busy={busy === item.account} className="mt-2 min-h-10 border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring" disabled={busy !== null} onClick={() => void onClaim(item)} type="button">{busy === item.account ? "Claiming…" : "Claim"}</button> : <p className="mt-1 text-xs text-muted-foreground">{item.claimed ? "Claimed" : resolved ? "Settlement complete" : "Result after resolution"}</p>}</div></article>;
}
function statusLabel(status: string) { return ({ scheduled: "Scheduled", betting: "Betting open", watching: "Watching", resolved: "Resolving", settled: "Settled", cancelled: "Cancelled" } as Record<string, string>)[status] ?? "Unavailable"; }
function AccountSkeleton() { return <div aria-label="Loading account" className="animate-pulse space-y-4"><div className="h-36 border bg-card" /><div className="grid gap-4 lg:grid-cols-[1fr_20rem]"><div className="h-96 border bg-card" /><div className="h-80 border bg-card" /></div></div>; }
