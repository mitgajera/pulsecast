import type { Metadata } from "next";
/* eslint-disable @next/next/no-html-link-for-pages */

import { AccountDashboard } from "@/features/account/account-dashboard";
import { AuthControl } from "@/features/auth/auth-control";

export const metadata: Metadata = { title: "Account" };

export default function ProfilePage() {
  return <div className="min-h-screen"><header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm"><div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><a className="flex min-h-11 items-center gap-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" href="/"><span aria-hidden="true">←</span><span>PulseCast</span></a><AuthControl /></div></header><main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8"><div className="mb-5"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Portfolio</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Your account</h1></div><AccountDashboard /></main></div>;
}
