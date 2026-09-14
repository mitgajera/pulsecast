"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { PublicKey } from "@solana/web3.js";
import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePulseCastAuth } from "@/features/auth/auth-context";
import { WalletAvatar } from "@/features/auth/wallet-avatar";
import { loadPortfolioLedger, mergePortfolioTrades, type PortfolioTrade } from "./portfolio-ledger";
import { useAccountOperation } from "./use-account-operation";

type Prediction = { account: string; actualPrice: number | null; claimType: "claim_payout" | "claim_refund"; claimable: boolean; claimed: boolean; entryAmountUsdc: number; error: number | null; payoutUsdc: number; predictedPrice: number; roundId: string | null; status: string; submittedAt: number };
type AccountData = { balanceUsdc: number; tokenAccount: string; tradeHistory: PortfolioTrade[]; wallet: string; predictions: Prediction[] };
type LoadState = "idle" | "loading" | "ready" | "error";
type PortfolioView = "activity" | "pnl";
type PnlPeriod = "day" | "week" | "month";

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
  const [portfolioView, setPortfolioView] = useState<PortfolioView>("activity");
  const [pnlPeriod, setPnlPeriod] = useState<PnlPeriod>("day");
  const [trades, setTrades] = useState<PortfolioTrade[]>(() => auth.address ? loadPortfolioLedger(auth.address) : []);
  const [copied, setCopied] = useState(false);
  const loadedWallet = useRef<string | null>(null);

  const fetchAccount = useCallback(async () => {
    if (!auth.address) return;
    const isBackgroundRefresh = loadedWallet.current === auth.address;
    if (!isBackgroundRefresh) setLoadState("loading");
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/account?wallet=${encodeURIComponent(auth.address)}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Account data could not load.");
      const accountData = payload as AccountData;
      setData(accountData);
      loadedWallet.current = auth.address;
      const currentTrades = accountData.predictions.map((item): PortfolioTrade => ({
        actualPrice: item.actualPrice,
        payoutUsdc: item.status === "settled" || item.status === "cancelled"
          ? (item.status === "cancelled" ? item.entryAmountUsdc : item.payoutUsdc)
          : null,
        predictedPrice: item.predictedPrice,
        roundId: item.roundId ?? item.account,
        stakeUsdc: item.entryAmountUsdc,
        status: item.status,
        submittedAt: item.submittedAt,
      }));
      setTrades(mergePortfolioTrades(auth.address, [...accountData.tradeHistory, ...currentTrades]));
      setLoadState("ready");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account data could not load."); setLoadState(isBackgroundRefresh ? "ready" : "error"); }
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
  async function copyWalletAddress() {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setMessage("Wallet address could not be copied. Select it and copy manually.");
    }
  }

  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <section className="grid shrink-0 border bg-card md:grid-cols-[1fr_auto] md:items-end"><div className="flex items-center gap-4 p-4 sm:px-5"><WalletAvatar address={walletAddress} size="lg" /><div><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Available balance</p><p className="mt-1 font-mono text-3xl font-semibold tabular-nums">{usdc.format(account.balanceUsdc)} <span className="text-sm font-medium text-muted-foreground">USDC</span></p><div className="flex items-center"><span className="font-mono text-xs text-muted-foreground" title={walletAddress}>{shortAddress(walletAddress)}</span><button aria-label={copied ? "Wallet address copied" : "Copy wallet address"} className="grid min-h-10 min-w-10 place-items-center text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => void copyWalletAddress()} title={copied ? "Copied" : "Copy address"} type="button">{copied ? <CheckIcon /> : <CopyIcon />}</button></div></div></div><dl className="grid grid-cols-2 border-t md:border-l md:border-t-0"><Stat label="Predictions" value={String(account.predictions.length)} /><Stat label="Claimable" value={`${usdc.format(claimable)} USDC`} /></dl></section>
    {message && <p className="border bg-card px-4 py-3 text-sm" role="status">{message}</p>}
    <div className="scrollbar-hidden grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex min-h-0 flex-col border bg-card">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b p-5"><div><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Portfolio</p><h1 className="mt-1 text-xl font-semibold">{portfolioView === "activity" ? "Prediction history" : "Profit and loss"}</h1></div><div aria-label="Portfolio view" className="flex border"><button aria-pressed={portfolioView === "activity"} className="min-h-10 px-4 text-sm font-medium aria-pressed:bg-accent aria-pressed:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => setPortfolioView("activity")} type="button">Activity</button><button aria-pressed={portfolioView === "pnl"} className="min-h-10 border-l px-4 text-sm font-medium aria-pressed:bg-accent aria-pressed:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => setPortfolioView("pnl")} type="button">P&amp;L</button></div></header>
        {portfolioView === "pnl" ? <PnlPanel period={pnlPeriod} setPeriod={setPnlPeriod} trades={trades} /> : account.predictions.length === 0 ? (
          <div className="p-8 text-center"><p className="font-medium">No predictions yet</p><p className="mt-2 text-sm text-muted-foreground">Enter a live minute market to start building your record.</p><a className="mt-5 inline-flex min-h-10 items-center text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring" href="/">View live market</a></div>
        ) : (
          <div aria-label="Prediction history entries" className="scrollbar-hidden min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain" role="region" tabIndex={0}>{account.predictions.map((item) => <PredictionRow busy={busy} item={item} key={item.account} onClaim={runClaim} />)}</div>
        )}
      </section>
      <aside className="h-fit border bg-card lg:sticky lg:top-20"><header className="border-b p-5"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Transfer</p><h2 className="mt-1 font-semibold">Withdraw USDC</h2></header><form className="space-y-4 p-5" onSubmit={reviewWithdrawal}><label className="block text-sm font-medium" htmlFor="destination">Destination wallet<input autoComplete="off" className="mt-2 min-h-11 w-full border bg-input px-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" id="destination" onChange={(event) => { setDestination(event.target.value.trim()); setConfirming(false); }} placeholder="Solana address" spellCheck={false} type="text" value={destination} /></label><label className="block text-sm font-medium" htmlFor="amount">Amount<div className="mt-2 flex min-h-11 border bg-input focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"><input className="min-w-0 flex-1 bg-transparent px-3 font-mono outline-none" id="amount" inputMode="decimal" onChange={(event) => { setAmount(event.target.value); setConfirming(false); }} placeholder="0.00" type="text" value={amount} /><span className="self-center pr-3 text-xs text-muted-foreground">USDC</span></div></label>{confirming ? <div className="space-y-3 border p-3"><p className="text-sm">Send <span className="font-mono">{amount} USDC</span> to <span className="font-mono">{shortAddress(destination)}</span>?</p><p className="text-xs text-muted-foreground">Network fee sponsored. This transfer cannot be reversed.</p><div className="grid grid-cols-2 gap-2"><button className="min-h-10 border text-sm" onClick={() => setConfirming(false)} type="button">Back</button><button aria-busy={busy === "withdraw"} className="min-h-10 bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={busy !== null} onClick={() => void withdraw()} type="button">{busy === "withdraw" ? "Sending…" : "Confirm"}</button></div></div> : <button className="min-h-11 w-full bg-primary font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" disabled={!amount || !destination || busy !== null} type="submit">Review withdrawal</button>}<p className="text-xs leading-5 text-muted-foreground">Transfers devnet USDC from your embedded wallet. SOL is not required.</p></form></aside>
    </div>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="min-w-36 p-5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</dd></div>; }
function CopyIcon() { return <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14"><rect height="13" rx="2" stroke="currentColor" strokeWidth="1.8" width="13" x="8" y="8" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>; }
function CheckIcon() { return <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>; }
function PnlPanel({ period, setPeriod, trades }: { period: PnlPeriod; setPeriod: (period: PnlPeriod) => void; trades: PortfolioTrade[] }) {
  const cutoff = periodCutoff(period);
  const completed = trades.filter((trade) => trade.payoutUsdc !== null && trade.submittedAt >= cutoff);
  const totalPnl = completed.reduce((sum, trade) => sum + (trade.payoutUsdc! - trade.stakeUsdc), 0);
  return <div>
    <div className="grid border-b sm:grid-cols-[1fr_auto] sm:items-end"><div className="p-5"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total P&amp;L</p><p className={`mt-2 font-mono text-3xl font-semibold tabular-nums ${pnlTone(totalPnl)}`}>{signedUsdc(totalPnl)}</p><p className="mt-2 text-xs text-muted-foreground">{completed.length} resolved {completed.length === 1 ? "market" : "markets"} in this period</p></div><div aria-label="P and L period" className="flex border-t sm:m-5 sm:border"><PeriodButton active={period === "day"} label="Today" onClick={() => setPeriod("day")} /><PeriodButton active={period === "week"} label="7D" onClick={() => setPeriod("week")} /><PeriodButton active={period === "month"} label="30D" onClick={() => setPeriod("month")} /></div></div>
    {trades.length === 0 ? <div className="p-8 text-center"><p className="font-medium">No trades recorded yet</p><p className="mt-2 text-sm text-muted-foreground">Your next confirmed prediction will appear here with its stake and result.</p><a className="mt-5 inline-flex min-h-10 items-center text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring" href="/">View live market</a></div> : <div aria-label="Profit and loss history" className="scrollbar-hidden max-h-96 divide-y overflow-y-auto overscroll-contain" role="region" tabIndex={0}>{trades.map((trade) => <PnlRow key={trade.roundId} trade={trade} />)}</div>}
  </div>;
}
function PeriodButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button aria-pressed={active} className="min-h-10 min-w-16 border-r px-3 text-sm font-medium last:border-r-0 aria-pressed:bg-accent aria-pressed:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={onClick} type="button">{label}</button>; }
function PnlRow({ trade }: { trade: PortfolioTrade }) {
  const complete = trade.payoutUsdc !== null;
  const net = complete ? trade.payoutUsdc! - trade.stakeUsdc : null;
  return <article className="grid min-h-24 gap-3 p-4 sm:grid-cols-[5rem_minmax(0,1fr)_8rem_8rem] sm:items-center sm:px-5"><div><p className="font-mono text-sm font-semibold">#{trade.roundId}</p><p className="mt-1 text-xs text-muted-foreground"><time dateTime={new Date(trade.submittedAt * 1_000).toISOString()}>{tradeDate.format(new Date(trade.submittedAt * 1_000))}</time></p></div><div><p className="text-xs text-muted-foreground">Prediction</p><p className="mt-1 font-mono text-sm tabular-nums">{price.format(trade.predictedPrice)}</p></div><div className="sm:text-right"><p className="text-xs text-muted-foreground">Stake / return</p><p className="mt-1 font-mono text-sm tabular-nums">{usdc.format(trade.stakeUsdc)} / {complete ? usdc.format(trade.payoutUsdc!) : "Pending"}</p></div><div className="sm:text-right"><p className="text-xs text-muted-foreground">Net P&amp;L</p><p className={`mt-1 font-mono text-sm font-semibold tabular-nums ${net === null ? "text-muted-foreground" : pnlTone(net)}`}>{net === null ? "Pending" : signedUsdc(net)}</p></div></article>;
}
function PredictionRow({ busy, item, onClaim }: { busy: string | null; item: Prediction; onClaim: (item: Prediction) => Promise<void> }) {
  const resolved = item.actualPrice !== null;
  const result = item.claimType === "claim_refund"
    ? `${usdc.format(item.entryAmountUsdc)} USDC refund`
    : !resolved
      ? "Pending"
      : item.payoutUsdc > 0
        ? `${usdc.format(item.payoutUsdc)} USDC payout`
        : "No payout";
  return <article className="grid min-h-24 gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-5"><div className="font-mono text-sm font-semibold">#{item.roundId ?? "—"}</div><div><p className="font-mono text-sm tabular-nums">Predicted {price.format(item.predictedPrice)}</p><p className="mt-1 text-xs text-muted-foreground">{resolved ? `Closed ${price.format(item.actualPrice!)}${item.error === null ? "" : ` · ${price.format(item.error)} away`}` : statusLabel(item.status)}</p></div><div className="sm:text-right"><p className="font-mono text-sm font-semibold tabular-nums">{result}</p>{item.claimable ? <button aria-busy={busy === item.account} className="mt-2 min-h-10 border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring" disabled={busy !== null} onClick={() => void onClaim(item)} type="button">{busy === item.account ? "Claiming…" : "Claim"}</button> : <p className="mt-1 text-xs text-muted-foreground">{item.claimed ? "Claimed" : resolved ? "Settlement complete" : "Result after resolution"}</p>}</div></article>;
}
function statusLabel(status: string) { return ({ scheduled: "Scheduled", betting: "Betting open", watching: "Watching", resolved: "Resolving", settled: "Settled", cancelled: "Cancelled" } as Record<string, string>)[status] ?? "Unavailable"; }
function periodCutoff(period: PnlPeriod) { const now = new Date(); if (period === "day") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1_000; return Math.floor(now.getTime() / 1_000) - (period === "week" ? 7 : 30) * 86_400; }
function pnlTone(value: number) { return value > 0 ? "text-chart-3" : value < 0 ? "text-destructive" : "text-muted-foreground"; }
function signedUsdc(value: number) { return `${value > 0 ? "+" : value < 0 ? "−" : ""}${usdc.format(Math.abs(value))} USDC`; }
const tradeDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
function AccountSkeleton() { return <div aria-label="Loading account" className="animate-pulse space-y-4"><div className="h-36 border bg-card" /><div className="grid gap-4 lg:grid-cols-[1fr_20rem]"><div className="h-96 border bg-card" /><div className="h-80 border bg-card" /></div></div>; }
