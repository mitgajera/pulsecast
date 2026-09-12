"use client";

import { useState } from "react";

import { usePulseCastAuth } from "./auth-context";
import { WalletAvatar } from "./wallet-avatar";

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function AuthControl() {
  const { address, authenticated, configured, login, logout, ready } = usePulseCastAuth();
  const [copied, setCopied] = useState(false);

  if (!configured) {
    return <button className="min-h-10 border bg-card px-4 text-sm font-medium text-muted-foreground" disabled type="button">Auth setup pending</button>;
  }

  if (!ready) {
    return <button aria-busy="true" className="min-h-10 border bg-card px-4 text-sm font-medium text-muted-foreground" disabled type="button">Checking account...</button>;
  }

  if (!authenticated) {
    return <button className="min-h-10 border bg-card px-4 text-sm font-medium transition-colors duration-100 hover:bg-accent active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={login} type="button">Sign in</button>;
  }

  if (!address) {
    return <button className="min-h-10 border bg-card px-4 text-sm font-medium text-muted-foreground" disabled type="button">Creating wallet...</button>;
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(address!);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <details className="group relative">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 border bg-card px-3 font-mono text-sm transition-colors duration-100 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <WalletAvatar address={address} />
        {shortAddress(address)}
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid w-48 border bg-popover p-1 shadow-lg">
        <a className="flex min-h-10 items-center px-3 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" href="/profile">Account &amp; payouts</a>
        <button className="min-h-10 px-3 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" onClick={copyAddress} type="button">{copied ? "Copied" : "Copy address"}</button>
        <a className="flex min-h-10 items-center px-3 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" href={`https://explorer.solana.com/address/${address}?cluster=devnet`} rel="noreferrer" target="_blank">View on explorer</a>
        <button className="min-h-10 border-t px-3 text-left text-sm text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" onClick={() => void logout()} type="button">Sign out</button>
      </div>
    </details>
  );
}
